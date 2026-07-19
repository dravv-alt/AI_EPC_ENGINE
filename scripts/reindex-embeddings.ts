import { and, isNotNull, isNull, ne, or } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { knowledgeChunks } from "../src/lib/db/schema";

// Slice 1: makes an EMBEDDING_PROVIDER switch deliberate and auditable. Given
// the model tag that is now active, this nulls out `embedding` (and clears
// `embeddingModel`) for every knowledgeChunks row currently tagged with a
// *different* model — i.e. anything left over from before the switch.
//
// It does NOT re-enqueue anything itself: the existing `knowledge.embed`
// backfill job (src/lib/jobs/worker.ts) already scans for
// `isNull(knowledgeChunks.embedding)` on every poll cycle / manual trigger and
// will pick these rows back up on its next pass, embedding them under the
// newly active model and writing the correct `embeddingModel` tag.
//
// Usage: npx tsx scripts/reindex-embeddings.ts <active-model-tag>
//   e.g. npx tsx scripts/reindex-embeddings.ts bge-base-en-v1.5
async function main() {
  const activeModelTag = process.argv[2];
  if (!activeModelTag) {
    console.error("Usage: npx tsx scripts/reindex-embeddings.ts <active-model-tag>");
    console.error("  e.g. npx tsx scripts/reindex-embeddings.ts bge-base-en-v1.5");
    process.exit(1);
  }

  const staleCondition = or(
    isNull(knowledgeChunks.embeddingModel),
    ne(knowledgeChunks.embeddingModel, activeModelTag)
  );

  const stale = await db
    .select({ id: knowledgeChunks.id, embeddingModel: knowledgeChunks.embeddingModel })
    .from(knowledgeChunks)
    .where(and(staleCondition, isNotNull(knowledgeChunks.embedding)));

  if (!stale.length) {
    console.log(`No chunks are tagged with a model other than "${activeModelTag}". Nothing to reindex.`);
    process.exit(0);
  }

  const result = await db
    .update(knowledgeChunks)
    .set({ embedding: null, embeddingModel: null, updatedAt: new Date() })
    .where(and(staleCondition, isNotNull(knowledgeChunks.embedding)))
    .returning({ id: knowledgeChunks.id });

  console.log(`Reindex triggered: cleared embedding + embeddingModel for ${result.length} chunk(s) not tagged "${activeModelTag}". The knowledge.embed backfill worker will re-embed them on its next pass.`);
}

main().then(() => process.exit(0)).catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
