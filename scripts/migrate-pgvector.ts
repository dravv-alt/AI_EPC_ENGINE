import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config();

const url = process.env.DATABASE_URL ?? "postgresql://pramana:pramana@localhost:5433/pramana";
const sql = postgres(url);

async function main() {
  console.log("Enabling pgvector extension...");
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;

  console.log("Adding embedding column to source_regions...");
  await sql`ALTER TABLE source_regions ADD COLUMN IF NOT EXISTS embedding vector(768)`;

  console.log("Creating IVFFlat index...");
  // IVFFlat requires at least `lists` number of rows to build. Use a safe fallback.
  const [{ count }] = await sql`SELECT count(*)::int as count FROM source_regions`;
  if (count >= 100) {
    await sql`
      CREATE INDEX IF NOT EXISTS source_regions_embedding_idx
        ON source_regions
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
    `;
  } else {
    // Fall back to exact search for small datasets
    await sql`
      CREATE INDEX IF NOT EXISTS source_regions_embedding_idx
        ON source_regions
        USING hnsw (embedding vector_cosine_ops)
    `;
  }

  console.log("pgvector migration complete.");
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
