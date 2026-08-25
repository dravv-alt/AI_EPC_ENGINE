import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { teachbackNotes } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { activeEmbeddingModelTag, getModelProvider } from "@/lib/model/provider";
import type { TeachbackSubjectType } from "@/lib/teachback/capture";

export type TeachbackAdvisory = {
  id: string;
  subjectType: string;
  subjectId: string;
  correctedFrom: unknown;
  correctedTo: unknown;
  rationale: string;
  sourceRegionId: string | null;
  similarity: number;
  createdAt: Date;
};

// Slice 8 "surface" step: on a similar future review, show matching prior
// rationale as advisory context. Matched by subjectType (mandatory, in SQL,
// before ranking — the same metadata-filter-first shape
// retrieveSemanticCitations uses over knowledgeChunks) + project scope +
// semantic similarity of the embedded `correctedFrom` text. This is a
// sibling of retrieveSemanticCitations rather than a literal call into it:
// that function is hard-wired to the ingestion-owned knowledgeChunks table,
// which has no notion of a teach-back subject. Never auto-applied — this
// only ever returns read-only advisory rows; nothing here writes to the
// subject being reviewed.
export async function surfaceTeachbackAdvisory(options: {
  projectId: string;
  subjectType: TeachbackSubjectType;
  queryText: string;
  threshold?: number;
  limit?: number;
}): Promise<TeachbackAdvisory[]> {
  const threshold = options.threshold ?? env.KNOWLEDGE_SIMILARITY_THRESHOLD;
  const limit = options.limit ?? 3;
  const provider = getModelProvider();
  const embedding = await provider.embed(options.queryText, "query");
  const vectorLiteral = `[${embedding.join(",")}]`;
  const similarity = sql<number>`1 - (${teachbackNotes.embedding} <=> ${vectorLiteral}::vector)`;

  const rows = await db
    .select({
      id: teachbackNotes.id,
      subjectType: teachbackNotes.subjectType,
      subjectId: teachbackNotes.subjectId,
      correctedFrom: teachbackNotes.correctedFrom,
      correctedTo: teachbackNotes.correctedTo,
      rationale: teachbackNotes.rationale,
      sourceRegionId: teachbackNotes.sourceRegionId,
      createdAt: teachbackNotes.createdAt,
      similarity
    })
    .from(teachbackNotes)
    .where(and(
      // Mandatory filters, evaluated before ranking: project scope (never
      // surface another project's corrections) + subject type + only rows
      // with a comparable embedding under the currently active model.
      eq(teachbackNotes.projectId, options.projectId),
      eq(teachbackNotes.subjectType, options.subjectType),
      sql`${teachbackNotes.embedding} is not null`,
      eq(teachbackNotes.embeddingModel, activeEmbeddingModelTag())
    ))
    .orderBy(sql`${teachbackNotes.embedding} <=> ${vectorLiteral}::vector`)
    .limit(limit * 2);

  return rows
    .filter((row) => Number(row.similarity) >= threshold)
    .slice(0, limit)
    .map((row) => ({ ...row, similarity: Number(row.similarity) }));
}
