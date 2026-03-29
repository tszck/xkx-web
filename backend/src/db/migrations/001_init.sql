-- Up Migration

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token        TEXT NOT NULL UNIQUE,
  player_id    BIGINT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE players (
  id           BIGSERIAL PRIMARY KEY,
  display_name TEXT NOT NULL,
  guest_name   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE player_state (
  player_id      BIGINT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  current_room   TEXT NOT NULL DEFAULT '/d/city/beimen',
  qi             INT NOT NULL DEFAULT 100,
  max_qi         INT NOT NULL DEFAULT 100,
  jing           INT NOT NULL DEFAULT 100,
  max_jing       INT NOT NULL DEFAULT 100,
  neili          INT NOT NULL DEFAULT 0,
  max_neili      INT NOT NULL DEFAULT 0,
  eff_qi         INT NOT NULL DEFAULT 100,
  eff_jing       INT NOT NULL DEFAULT 100,
  str            INT NOT NULL DEFAULT 15,
  con            INT NOT NULL DEFAULT 15,
  dex            INT NOT NULL DEFAULT 15,
  int_stat       INT NOT NULL DEFAULT 15,
  per            INT NOT NULL DEFAULT 15,
  kar            INT NOT NULL DEFAULT 15,
  sta            INT NOT NULL DEFAULT 15,
  spi            INT NOT NULL DEFAULT 10,
  combat_exp     BIGINT NOT NULL DEFAULT 0,
  age            INT NOT NULL DEFAULT 14,
  shen           INT NOT NULL DEFAULT 0,
  shen_type      INT NOT NULL DEFAULT 0,
  potential      INT NOT NULL DEFAULT 1000,
  learned_points INT NOT NULL DEFAULT 0,
  money          BIGINT NOT NULL DEFAULT 500,
  family_name    TEXT,
  family_generation INT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE player_skills (
  player_id  BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  skill_id   TEXT NOT NULL,
  level      INT NOT NULL DEFAULT 0,
  mapped_to  TEXT,
  PRIMARY KEY (player_id, skill_id)
);

CREATE TABLE player_inventory (
  id         BIGSERIAL PRIMARY KEY,
  player_id  BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  item_id    TEXT NOT NULL,
  quantity   INT NOT NULL DEFAULT 1,
  slot       TEXT,
  extra_data JSONB
);

CREATE TABLE player_quests (
  player_id    BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  quest_id     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',
  assigned_npc TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (player_id, quest_id)
);

CREATE INDEX ON sessions(token);
CREATE INDEX ON sessions(player_id);
CREATE INDEX ON player_skills(player_id);
CREATE INDEX ON player_inventory(player_id);
CREATE INDEX ON player_quests(player_id, status);

-- Down Migration (append after a separator comment if using node-pg-migrate)
