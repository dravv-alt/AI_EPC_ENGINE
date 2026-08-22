-- Custom SQL migration file, put your code below! --
-- Correct the original deterministic backfill for databases that applied
-- migration 0020 before its regex escaping was fixed.
UPDATE "requirements"
SET
  "display_title" = array_to_string((regexp_split_to_array(regexp_replace("statement", E'\\s+', ' ', 'g'), ' '))[1:9], ' '),
  "display_summary" = array_to_string((regexp_split_to_array(regexp_replace("statement", E'\\s+', ' ', 'g'), ' '))[1:28], ' '),
  "presentation_provider" = COALESCE("presentation_provider", 'source-derived-v1');
