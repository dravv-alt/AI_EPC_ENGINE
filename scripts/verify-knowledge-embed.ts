import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { knowledgeChunks } from "../src/lib/db/schema";

// Slice 6: every knowledge chunk must gain a populated embedding vector via the
// bootstrap `knowledge.embed` backfill worker — no manual trigger — and the
// pgvector index must be queryable by cosine distance. We poll until the backfill
// has embedded every chunk, then run a nearest-neighbour query using an existing
// chunk's own embedding to confirm the index ranks it first.
async function main() {
  let total = 0;
  let embedded = 0;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const [counts] = await db
      .select({ total: sql<number>`count(*)::int`, embedded: sql<number>`count(${knowledgeChunks.embedding})::int` })
      .from(knowledgeChunks);
    total = counts.total;
    embedded = counts.embedded;
    if (total > 0 && embedded === total) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  assert.ok(total > 0, "There must be knowledge chunks to embed.");
  assert.equal(embedded, total, `Every chunk must be embedded by the backfill worker (embedded ${embedded}/${total}).`);

  const [probe] = await db
    .select({ id: knowledgeChunks.id, embedding: sql<string>`${knowledgeChunks.embedding}::text` })
    .from(knowledgeChunks)
    .limit(1);
  assert.ok(probe?.embedding, "A chunk must expose its embedding vector.");

  const ranked = await db
    .select({ id: knowledgeChunks.id, distance: sql<number>`${knowledgeChunks.embedding} <=> ${probe.embedding}::vector` })
    .from(knowledgeChunks)
    .orderBy(sql`${knowledgeChunks.embedding} <=> ${probe.embedding}::vector`)
    .limit(3);
  assert.equal(ranked[0].id, probe.id, "A chunk must be its own nearest neighbour under cosine distance.");
  assert.ok(ranked[0].distance < 1e-6, "The self-distance must be ~0.");

  console.log(`pgvector backfill verified: ${embedded}/${total} chunks embedded; nearest-neighbour self-distance ${ranked[0].distance}.`);
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
