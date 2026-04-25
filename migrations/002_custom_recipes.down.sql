-- Rollback fuer 002_custom_recipes
ALTER TABLE recipe_cache
  DROP FOREIGN KEY fk_recipe_creator,
  DROP FOREIGN KEY fk_recipe_household;

ALTER TABLE recipe_cache
  DROP KEY ix_recipe_household,
  DROP COLUMN created_by,
  DROP COLUMN household_id;
