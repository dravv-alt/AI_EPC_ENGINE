import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const VERSION_IDS = [
  "a59c4273-fb2d-4f69-8572-0251b5527184",
  "e1a22e97-0da7-499a-bb0e-b1449678df7e",
  "83fbc552-28fc-4a18-935b-1a454d0aac25",
  "86154441-098f-44c3-bea9-30fbbd0e7372",
  "c02788eb-7272-4555-9ae2-794542cf4da4"
] as const;

const MODEL_TAG = "bge-base-en-v1.5";
const BATCH_SIZE = 16;
// BGE-base consumes at most 512 tokens. Bound before tokenization so page-sized
// regions do not waste CPU on text the encoder would truncate internally.
const MAX_PASSAGE_CHARS = 2_000;

async function main() {
  if (process.env.EMBEDDING_PROVIDER !== "service") throw new Error("EMBEDDING_PROVIDER must be service.");
  const [{ db }, schema, operators] = await Promise.all([
    import("../src/lib/db/client"),
    import("../src/lib/db/schema"),
    import("drizzle-orm")
  ]);
  const { knowledgeChunks, sourceRegions } = schema;
  const { eq, inArray, ne, and } = operators;
  const chunks = await db.select({ id: knowledgeChunks.id, content: knowledgeChunks.content })
    .from(knowledgeChunks)
    .innerJoin(sourceRegions, eq(knowledgeChunks.sourceRegionId, sourceRegions.id))
    .where(and(inArray(sourceRegions.documentVersionId, [...VERSION_IDS]), ne(knowledgeChunks.embeddingModel, MODEL_TAG)));

  console.log(`Re-embedding ${chunks.length} Minneapolis source chunks with ${MODEL_TAG}.`);
  let completed = 0;
  for (let offset = 0; offset < chunks.length; offset += BATCH_SIZE) {
    const batch = chunks.slice(offset, offset + BATCH_SIZE);
    const response = await fetch(`${process.env.RETRIEVAL_SERVICE_URL ?? "http://localhost:8003"}/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: batch.map((chunk) => chunk.content.slice(0, MAX_PASSAGE_CHARS)), kind: "passage" }),
      signal: AbortSignal.timeout(120_000)
    });
    if (!response.ok) throw new Error(`Retrieval service returned ${response.status}: ${await response.text()}`);
    const body = await response.json() as { embeddings: number[][]; dimensions: number; model: string };
    if (body.dimensions !== 768 || body.embeddings.length !== batch.length) throw new Error("Retrieval embedding response shape is invalid.");
    for (let index = 0; index < batch.length; index += 16) {
      await Promise.all(batch.slice(index, index + 16).map((chunk, localIndex) => db.update(knowledgeChunks).set({
        embedding: body.embeddings[index + localIndex],
        embeddingModel: MODEL_TAG,
        updatedAt: new Date()
      }).where(eq(knowledgeChunks.id, chunk.id))));
    }
    completed += batch.length;
    console.log(`${completed}/${chunks.length}`);
  }
  console.log(JSON.stringify({ completed, model: MODEL_TAG, versions: VERSION_IDS.length }));
  process.exit(0);
}

main().catch((error) => { console.error(error); process.exit(1); });
