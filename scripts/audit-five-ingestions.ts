import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
const { db } = await import("../src/lib/db/client");
const { documents, documentVersions, sourceRegions, knowledgeChunks } = await import("../src/lib/db/schema");
const { eq, sql } = await import("drizzle-orm");

const rows = await db.select({
  title: documents.title,
  type: documents.documentType,
  versionId: documentVersions.id,
  status: documentVersions.status,
  extraction: documentVersions.extractionStatus,
  objectKey: documentVersions.objectKey,
  regions: sql<number>`count(distinct ${sourceRegions.id})::int`,
  chunks: sql<number>`count(distinct ${knowledgeChunks.id})::int`,
  embedded: sql<number>`count(distinct case when ${knowledgeChunks.embedding} is not null then ${knowledgeChunks.id} end)::int`,
  models: sql<string>`string_agg(distinct ${knowledgeChunks.embeddingModel}, ',')`
}).from(documents)
  .innerJoin(documentVersions, eq(documentVersions.documentId, documents.id))
  .leftJoin(sourceRegions, eq(sourceRegions.documentVersionId, documentVersions.id))
  .leftJoin(knowledgeChunks, eq(knowledgeChunks.sourceRegionId, sourceRegions.id))
  .groupBy(documents.title, documents.documentType, documentVersions.id, documentVersions.status, documentVersions.extractionStatus, documentVersions.objectKey);

console.log(JSON.stringify(rows.filter((row) => /Minneapolis|MCR Update|Brand Name/i.test(row.title) || /Minneapolis|MCR.Update|Brand.Name/i.test(row.objectKey)), null, 2));
process.exit(0);
}

main().catch((error) => { console.error(error); process.exit(1); });
