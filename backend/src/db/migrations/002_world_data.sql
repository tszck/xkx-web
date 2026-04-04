-- Up Migration

CREATE TABLE IF NOT EXISTS world_rooms (
  id         TEXT PRIMARY KEY,
  domain     TEXT NOT NULL,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_npcs (
  id         TEXT PRIMARY KEY,
  domain     TEXT NOT NULL,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_items (
  id         TEXT PRIMARY KEY,
  domain     TEXT NOT NULL,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_skills (
  id         TEXT PRIMARY KEY,
  domain     TEXT NOT NULL,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS world_rooms_domain_idx ON world_rooms(domain);
CREATE INDEX IF NOT EXISTS world_npcs_domain_idx ON world_npcs(domain);
CREATE INDEX IF NOT EXISTS world_items_domain_idx ON world_items(domain);
CREATE INDEX IF NOT EXISTS world_skills_domain_idx ON world_skills(domain);

-- Down Migration
