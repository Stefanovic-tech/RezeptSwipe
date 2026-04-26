-- ===========================================================================
-- 003_recipe_de_content.up.sql
-- Markiert pro recipe_cache-Zeile, ob deutsche Inhalte (title_de, ingredients,
-- steps) bereits zuverlaessig vorliegen, und schuetzt parallele Lazy-LLM-Calls
-- per Lock-Zeitstempel.
-- ===========================================================================

ALTER TABLE recipe_cache
  ADD COLUMN de_content_ready TINYINT(1) NOT NULL DEFAULT 0 AFTER steps_json,
  ADD COLUMN de_translate_locked_at DATETIME NULL AFTER de_content_ready;

ALTER TABLE recipe_cache
  ADD KEY ix_recipe_de_ready (de_content_ready);

-- Backfill: Haushalts-/Custom-Rezepte sind per Definition deutsch erfasst.
UPDATE recipe_cache
   SET de_content_ready = 1
 WHERE source <> 'themealdb';

-- TheMealDB-Rezepte: Wenn der deutsche Titel sich vom Original unterscheidet,
-- wurde frueher (ueblicherweise per Gemini) erfolgreich uebersetzt -> ready.
UPDATE recipe_cache
   SET de_content_ready = 1
 WHERE source = 'themealdb'
   AND title_orig IS NOT NULL
   AND title_de <> title_orig;
