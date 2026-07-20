import postgres from "postgres";
import * as dotenv from "dotenv";
import { generateEmbedding } from "../src/lib/knowledge/embed";

dotenv.config();

const url = process.env.DATABASE_URL ?? "postgresql://pramana:pramana@localhost:5433/pramana";
const sql = postgres(url);

async function main() {
  const rows = await sql`
    SELECT id, extracted_text FROM source_regions
    WHERE embedding IS NULL
    ORDER BY created_at
  `;

  console.log(`Found ${rows.length} regions without embeddings.`);

  let success = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const text = row.extracted_text as string;
      if (text.length < 10) { console.log(`Skipping ${row.id} (too short)`); continue; }

      const embedding = await generateEmbedding(text.slice(0, 8000)); // Gemini limit
      const vectorStr = `[${embedding.join(",")}]`;
      await sql`UPDATE source_regions SET embedding = ${vectorStr}::vector WHERE id = ${row.id}`;
      success++;

      // Rate limiting: Gemini free tier = 1500 requests/min
      if (success % 50 === 0) {
        console.log(`Embedded ${success}/${rows.length}...`);
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (error) {
      console.error(`Failed to embed ${row.id}:`, error);
      failed++;
    }
  }

  console.log(`Done. Success: ${success}, Failed: ${failed}`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
