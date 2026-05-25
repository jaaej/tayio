import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// `prepare: false` is required by the Supabase transaction pooler.
// `max: 10` caps the per-server connection pool — important for the dev
// hot-reload loop where stale connections can stack up.
const client = postgres(connectionString, { prepare: false, max: 10 });

export const db = drizzle(client, { schema });
export type DB = typeof db;
