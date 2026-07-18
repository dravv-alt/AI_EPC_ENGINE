CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD COLUMN "embedding" vector(768);--> statement-breakpoint
CREATE INDEX "knowledge_chunks_embedding_idx" ON "knowledge_chunks" USING ivfflat ("embedding" vector_cosine_ops);