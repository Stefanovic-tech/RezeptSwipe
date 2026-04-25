-- ===========================================================================
-- 002_custom_recipes.up.sql
-- Erweitert recipe_cache um Haushalts-Scope, damit Mitglieder eigene Rezepte
-- anlegen koennen. NULL = global (Seed/External), sonst gehoert das Rezept
-- ausschliesslich einem Haushalt.
-- ===========================================================================

ALTER TABLE recipe_cache
  ADD COLUMN household_id BIGINT UNSIGNED NULL AFTER id,
  ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER household_id;

ALTER TABLE recipe_cache
  ADD KEY ix_recipe_household (household_id),
  ADD CONSTRAINT fk_recipe_household
      FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_recipe_creator
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
