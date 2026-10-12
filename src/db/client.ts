import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// In Next.js dev mode, hot-reload re-evaluates this module and creates a
// fresh postgres client each time, leaking connections until the DB hits its
// max-clients ceiling. Cache the client on globalThis so HMR reuses it.
type GlobalWithDb = typeof globalThis & {
  __pgClient?: ReturnType<typeof postgres>;
};
const globalForDb = globalThis as GlobalWithDb;

// No query pipelining. DATABASE_URL is Supabase's transaction pooler
// (Supavisor, port 6543), and when postgres-js pipelines several queries on
// one connection (any page that fires more parallel queries than `max`) the
// pooler can leave a backend waiting mid-message forever ("active /
// ClientRead"), hanging the request. Reproduced 12 Oct 2026 with the
// /admin/users loaders: 6 of 6 rounds stalled with pipelining, 0 of 6 with it
// off. Queries beyond `max` now queue in the client. `max_pipeline` is a
// supported runtime option that postgres-js's typings omit, hence the
// separate object.
const NO_PIPELINING = { max_pipeline: 0 };

const client =
  globalForDb.__pgClient ??
  postgres(connectionString, {
    prepare: false,
    max: 10,
    // Supabase's transaction pooler can discard an upstream connection while
    // a laptop/dev server remains alive. Keeping that socket forever makes the
    // next refresh wait for the operating system's dead-connection timeout
    // (observed at almost two minutes). Recycle quiet sockets and probe live
    // ones so a request reconnects promptly instead.
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 10,
    keep_alive: 30,
    ...NO_PIPELINING,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgClient = client;
}

export const db = drizzle(client, { schema });
export type DB = typeof db;
