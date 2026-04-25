-- Rollback fuer 001_initial_schema. Reihenfolge: Kinder zuerst.
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS rate_limit_buckets;
DROP TABLE IF EXISTS admin_audit_log;
DROP TABLE IF EXISTS shopping_list_items;
DROP TABLE IF EXISTS shopping_lists;
DROP TABLE IF EXISTS cooking_session_choices;
DROP TABLE IF EXISTS cooking_sessions;
DROP TABLE IF EXISTS household_recipe_state;
DROP TABLE IF EXISTS recipe_cache;
DROP TABLE IF EXISTS household_preferences;
DROP TABLE IF EXISTS household_invites;
DROP TABLE IF EXISTS household_members;
DROP TABLE IF EXISTS user_recovery_codes;
DROP TABLE IF EXISTS refresh_sessions;
ALTER TABLE users DROP FOREIGN KEY fk_user_current_household;
DROP TABLE IF EXISTS households;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;
