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
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgClient = client;
}

export const db = drizzle(client, { schema });
export type DB = typeof db;
