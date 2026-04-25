-- ===========================================================================
-- 001_initial_schema.up.sql
-- Initiales Schema: Users, Sessions, Recovery, Haushalte, Invites, Rezepte,
-- Swipe-Status, Kochen, Einkauf, Praeferenzen, Admin-Audit.
-- MySQL 8.0+ / MariaDB 10.4+. Charset: utf8mb4.
-- ===========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
  username        VARCHAR(32)          NOT NULL,
  username_lower  VARCHAR(32)          NOT NULL,
  password_hash   VARCHAR(255)         NOT NULL,
  is_admin        TINYINT(1)           NOT NULL DEFAULT 0,
  is_banned       TINYINT(1)           NOT NULL DEFAULT 0,
  current_household_id BIGINT UNSIGNED NULL,
  created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at   DATETIME             NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username_lower (username_lower)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- REFRESH SESSIONS (DB-persistiert, rotation, pro-Geraet widerrufbar)
-- ---------------------------------------------------------------------------
CREATE TABLE refresh_sessions (
  id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED      NOT NULL,
  token_hash      CHAR(64)             NOT NULL,
  device_label    VARCHAR(120)         NULL,
  user_agent      VARCHAR(255)         NULL,
  ip_address      VARCHAR(64)          NULL,
  created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at    DATETIME             NULL,
  expires_at      DATETIME             NOT NULL,
  revoked_at      DATETIME             NULL,
  rotated_to_id   BIGINT UNSIGNED      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_token_hash (token_hash),
  KEY ix_refresh_user (user_id),
  KEY ix_refresh_expires (expires_at),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_refresh_rotated FOREIGN KEY (rotated_to_id) REFERENCES refresh_sessions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- RECOVERY CODES (Hash; einmalige Nutzung)
-- ---------------------------------------------------------------------------
CREATE TABLE user_recovery_codes (
  id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
  user_id         BIGINT UNSIGNED      NOT NULL,
  code_hash       CHAR(64)             NOT NULL,
  created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at         DATETIME             NULL,
  PRIMARY KEY (id),
  KEY ix_recovery_user (user_id),
  CONSTRAINT fk_recovery_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- HAUSHALTE
-- ---------------------------------------------------------------------------
CREATE TABLE households (
  id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
  name            VARCHAR(80)          NOT NULL,
  created_by      BIGINT UNSIGNED      NULL,
  created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_household_creator (created_by),
  CONSTRAINT fk_household_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE users
  ADD CONSTRAINT fk_user_current_household
  FOREIGN KEY (current_household_id) REFERENCES households(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- HAUSHALTS-MITGLIEDSCHAFTEN
-- ---------------------------------------------------------------------------
CREATE TABLE household_members (
  household_id    BIGINT UNSIGNED      NOT NULL,
  user_id         BIGINT UNSIGNED      NOT NULL,
  role            ENUM('owner','member') NOT NULL DEFAULT 'member',
  joined_at       DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (household_id, user_id),
  KEY ix_household_members_user (user_id),
  CONSTRAINT fk_hm_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  CONSTRAINT fk_hm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- INVITES (Code nur als Hash speichern)
-- ---------------------------------------------------------------------------
CREATE TABLE household_invites (
  id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
  household_id    BIGINT UNSIGNED      NOT NULL,
  code_hash       CHAR(64)             NOT NULL,
  code_preview    VARCHAR(8)           NULL,
  created_by      BIGINT UNSIGNED      NULL,
  created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      DATETIME             NULL,
  max_uses        INT UNSIGNED         NOT NULL DEFAULT 1,
  used_count      INT UNSIGNED         NOT NULL DEFAULT 0,
  revoked_at      DATETIME             NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invite_code_hash (code_hash),
  KEY ix_invite_household (household_id),
  KEY ix_invite_creator (created_by),
  CONSTRAINT fk_invite_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  CONSTRAINT fk_invite_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- HAUSHALTS-PRAEFERENZEN (Filter, fuer Swipe)
-- ---------------------------------------------------------------------------
CREATE TABLE household_preferences (
  household_id    BIGINT UNSIGNED      NOT NULL,
  vegetarian      TINYINT(1)           NOT NULL DEFAULT 0,
  vegan           TINYINT(1)           NOT NULL DEFAULT 0,
  no_pork         TINYINT(1)           NOT NULL DEFAULT 0,
  updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (household_id),
  CONSTRAINT fk_pref_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- REZEPT-CACHE (eine Zeile pro externes Rezept)
-- ---------------------------------------------------------------------------
CREATE TABLE recipe_cache (
  id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
  source          VARCHAR(40)          NOT NULL,
  external_id     VARCHAR(80)          NOT NULL,
  title_de        VARCHAR(255)         NOT NULL,
  title_orig      VARCHAR(255)         NULL,
  image_url       VARCHAR(512)         NULL,
  category        VARCHAR(80)          NULL,
  area            VARCHAR(80)          NULL,
  tags            VARCHAR(255)         NULL,
  is_vegetarian   TINYINT(1)           NOT NULL DEFAULT 0,
  is_vegan        TINYINT(1)           NOT NULL DEFAULT 0,
  has_pork        TINYINT(1)           NOT NULL DEFAULT 0,
  effort          ENUM('quick','normal','elaborate') NOT NULL DEFAULT 'normal',
  est_minutes     INT UNSIGNED         NULL,
  ingredients_json JSON                NOT NULL,
  steps_json      JSON                 NOT NULL,
  raw_payload     JSON                 NULL,
  created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_recipe_source_external (source, external_id),
  KEY ix_recipe_diet (is_vegetarian, is_vegan, has_pork),
  KEY ix_recipe_effort (effort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- SWIPE / KOCHBUCH-STATUS (pro Haushalt)
-- ---------------------------------------------------------------------------
CREATE TABLE household_recipe_state (
  household_id    BIGINT UNSIGNED      NOT NULL,
  recipe_id       BIGINT UNSIGNED      NOT NULL,
  status          ENUM('liked','passed') NOT NULL,
  decided_by      BIGINT UNSIGNED      NULL,
  decided_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (household_id, recipe_id),
  KEY ix_hrs_recipe (recipe_id),
  KEY ix_hrs_status (status),
  CONSTRAINT fk_hrs_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  CONSTRAINT fk_hrs_recipe FOREIGN KEY (recipe_id) REFERENCES recipe_cache(id) ON DELETE CASCADE,
  CONSTRAINT fk_hrs_user FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- KOCH-SESSIONS
-- ---------------------------------------------------------------------------
CREATE TABLE cooking_sessions (
  id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
  household_id    BIGINT UNSIGNED      NOT NULL,
  started_by      BIGINT UNSIGNED      NULL,
  effort          ENUM('quick','normal','elaborate','any') NOT NULL DEFAULT 'any',
  max_minutes     INT UNSIGNED         NULL,
  status          ENUM('active','finished','cancelled') NOT NULL DEFAULT 'active',
  created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at     DATETIME             NULL,
  PRIMARY KEY (id),
  KEY ix_cs_household (household_id),
  KEY ix_cs_status (status),
  CONSTRAINT fk_cs_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE,
  CONSTRAINT fk_cs_user FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cooking_session_choices (
  id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
  session_id      BIGINT UNSIGNED      NOT NULL,
  recipe_id       BIGINT UNSIGNED      NOT NULL,
  accepted        TINYINT(1)           NOT NULL DEFAULT 0,
  decided_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_csc_session_recipe (session_id, recipe_id),
  KEY ix_csc_recipe (recipe_id),
  CONSTRAINT fk_csc_session FOREIGN KEY (session_id) REFERENCES cooking_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_csc_recipe FOREIGN KEY (recipe_id) REFERENCES recipe_cache(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- EINKAUFSLISTE
-- ---------------------------------------------------------------------------
CREATE TABLE shopping_lists (
  id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
  household_id    BIGINT UNSIGNED      NOT NULL,
  status          ENUM('open','done')  NOT NULL DEFAULT 'open',
  created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  closed_at       DATETIME             NULL,
  PRIMARY KEY (id),
  KEY ix_sl_household (household_id),
  KEY ix_sl_status (status),
  CONSTRAINT fk_sl_household FOREIGN KEY (household_id) REFERENCES households(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE shopping_list_items (
  id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
  list_id         BIGINT UNSIGNED      NOT NULL,
  recipe_id       BIGINT UNSIGNED      NULL,
  name            VARCHAR(120)         NOT NULL,
  amount          DECIMAL(10,2)        NULL,
  unit            VARCHAR(20)          NULL,
  checked         TINYINT(1)           NOT NULL DEFAULT 0,
  created_by      BIGINT UNSIGNED      NULL,
  created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_sli_list (list_id),
  KEY ix_sli_recipe (recipe_id),
  KEY ix_sli_checked (checked),
  CONSTRAINT fk_sli_list FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE,
  CONSTRAINT fk_sli_recipe FOREIGN KEY (recipe_id) REFERENCES recipe_cache(id) ON DELETE SET NULL,
  CONSTRAINT fk_sli_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- ADMIN AUDIT LOG
-- ---------------------------------------------------------------------------
CREATE TABLE admin_audit_log (
  id              BIGINT UNSIGNED      NOT NULL AUTO_INCREMENT,
  actor_user_id   BIGINT UNSIGNED      NULL,
  action          VARCHAR(80)          NOT NULL,
  target_user_id  BIGINT UNSIGNED      NULL,
  target_household_id BIGINT UNSIGNED  NULL,
  meta            JSON                 NULL,
  created_at      DATETIME             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_audit_actor (actor_user_id),
  KEY ix_audit_target_user (target_user_id),
  KEY ix_audit_action (action),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_target_user FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_target_household FOREIGN KEY (target_household_id) REFERENCES households(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- RATE LIMIT (persistent, IP/Subjekt-basierte Counter mit Bucket)
-- ---------------------------------------------------------------------------
CREATE TABLE rate_limit_buckets (
  bucket_key      VARCHAR(160)         NOT NULL,
  window_start    DATETIME             NOT NULL,
  count           INT UNSIGNED         NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key),
  KEY ix_rate_window (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
