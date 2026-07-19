-- Enable pgvector (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add nullable embedding column — won't break existing rows
ALTER TABLE source_regions
  ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS source_regions_embedding_idx
  ON source_regions
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
