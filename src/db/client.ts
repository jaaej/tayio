import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Supabase's transaction pooler can discard an upstream connection while a
// laptop/dev server remains alive. Keeping that socket forever makes the next
// refresh wait for the operating system's dead-connection timeout (observed
// at almost two minutes). Recycle quiet sockets and probe live ones so a
// request reconnects promptly instead.
const BASE_OPTIONS = {
  prepare: false,
  idle_timeout: 20,
  connect_timeout: 10,
  max_lifetime: 60 * 10,
  keep_alive: 30,
};

/*
 * Two clients, because DATABASE_URL is Supabase's transaction pooler
 * (Supavisor, port 6543) and it hangs on pipelined queries: when postgres-js
 * sends a second query down a connection before the first returns (any page
 * firing more parallel queries than `max`), the pooler can leave a backend
 * "active / ClientRead" forever and the request never finishes. Reproduced
 * 12 Oct 2026 with the /admin/users loaders: 8 of 8 rounds stalled with
 * pipelining on (max_pipeline 100 or 1), 0 of 6 with it off.
 *
 * - `queryClient` runs ordinary queries with pipelining off
 *   (`max_pipeline: 0`, a supported runtime option the typings omit);
 *   queries beyond `max` wait in the client instead.
 * - `transactionClient` runs `begin()`. postgres-js only reserves a
 *   transaction's connection when pipelining is allowed (with 0 every
 *   transaction fails UNSAFE_TRANSACTION), and a reserved connection never
 *   carries anyone else's queries, so transactions cannot pipeline anyway.
 */
type PgClient = ReturnType<typeof postgres>;
type DbClients = { query: PgClient; transaction: PgClient };

// In Next.js dev mode, hot-reload re-evaluates this module and creates fresh
// clients each time, leaking connections until the DB hits its max-clients
// ceiling. Cache them on globalThis so HMR reuses them.
const globalForDb = globalThis as typeof globalThis & { __pgClients?: DbClients };

function createClients(url: string): DbClients {
  const noPipelining = { max_pipeline: 0 };
  return {
    query: postgres(url, { ...BASE_OPTIONS, max: 10, ...noPipelining }),
    transaction: postgres(url, { ...BASE_OPTIONS, max: 5 }),
  };
}

const clients = globalForDb.__pgClients ?? createClients(connectionString);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgClients = clients;
}

// Drizzle sees one client; only `begin` is routed to the transaction client.
const client = new Proxy(clients.query, {
  get(target, prop, receiver) {
    if (prop === "begin") return clients.transaction.begin;
    return Reflect.get(target, prop, receiver);
  },
});

export const db = drizzle(client, { schema });
export type DB = typeof db;

// drizzle() swaps some type parsers on the client it is given (dates and
// times stay strings). Mirror that onto the transaction client before any
// query runs, so values read inside a transaction have the same shape.
Object.assign(clients.transaction.options.parsers, clients.query.options.parsers);
Object.assign(
  clients.transaction.options.serializers,
  clients.query.options.serializers,
);
