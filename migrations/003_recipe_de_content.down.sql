-- Rollback fuer 003_recipe_de_content
ALTER TABLE recipe_cache
  DROP KEY ix_recipe_de_ready;

ALTER TABLE recipe_cache
  DROP COLUMN de_translate_locked_at,
  DROP COLUMN de_content_ready;
