import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "@/lib/db/schema";

/**
 * PostgreSQL is intentionally the only authoritative application database.
 * The same client works against local Docker Postgres and Neon because both
 * expose the PostgreSQL wire protocol through DATABASE_URL.
 */
const queryClient = postgres(env.DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10
});

export const db = drizzle(queryClient, { schema });
