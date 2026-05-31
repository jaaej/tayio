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
  postgres(connectionString, { prepare: false, max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pgClient = client;
}

export const db = drizzle(client, { schema });
export type DB = typeof db;
