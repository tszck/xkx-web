/* eslint-disable camelcase */

export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS world_room_exits (
      from_room_id TEXT NOT NULL,
      direction    TEXT NOT NULL,
      to_room_id   TEXT NOT NULL,
      meta         JSONB,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (from_room_id, direction)
    );

    CREATE TABLE IF NOT EXISTS world_room_npc_spawns (
      room_id      TEXT NOT NULL,
      npc_id       TEXT NOT NULL,
      spawn_count  INT NOT NULL DEFAULT 1,
      spawn_meta   JSONB,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (room_id, npc_id)
    );

    CREATE TABLE IF NOT EXISTS world_room_item_spawns (
      room_id      TEXT NOT NULL,
      item_id      TEXT NOT NULL,
      spawn_count  INT NOT NULL DEFAULT 1,
      spawn_meta   JSONB,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (room_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS player_position (
      player_id    BIGINT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      room_id      TEXT NOT NULL,
      revision     BIGINT NOT NULL DEFAULT 1,
      moved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS player_action_state (
      player_id    BIGINT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      mode         TEXT NOT NULL DEFAULT 'idle',
      target_id    TEXT,
      context      JSONB,
      cooldown_until TIMESTAMPTZ,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS player_room_overrides (
      player_id    BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      room_id      TEXT NOT NULL,
      override_type TEXT NOT NULL,
      data         JSONB NOT NULL,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (player_id, room_id, override_type)
    );

    CREATE TABLE IF NOT EXISTS player_action_log (
      id           BIGSERIAL PRIMARY KEY,
      player_id    BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      action_type  TEXT NOT NULL,
      payload      JSONB,
      result_code  TEXT NOT NULL,
      result_data  JSONB,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS player_tick_state (
      player_id    BIGINT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      tick_count   BIGINT NOT NULL DEFAULT 0,
      last_tick_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS world_room_exits_to_idx ON world_room_exits(to_room_id);
    CREATE INDEX IF NOT EXISTS world_room_npc_spawns_npc_idx ON world_room_npc_spawns(npc_id);
    CREATE INDEX IF NOT EXISTS world_room_item_spawns_item_idx ON world_room_item_spawns(item_id);
    CREATE INDEX IF NOT EXISTS player_position_room_idx ON player_position(room_id);
    CREATE INDEX IF NOT EXISTS player_action_log_player_created_idx ON player_action_log(player_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS player_room_overrides_player_room_idx ON player_room_overrides(player_id, room_id);
  `)
};

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS player_room_overrides_player_room_idx;
    DROP INDEX IF EXISTS player_action_log_player_created_idx;
    DROP INDEX IF EXISTS player_position_room_idx;
    DROP INDEX IF EXISTS world_room_item_spawns_item_idx;
    DROP INDEX IF EXISTS world_room_npc_spawns_npc_idx;
    DROP INDEX IF EXISTS world_room_exits_to_idx;

    DROP TABLE IF EXISTS player_tick_state;
    DROP TABLE IF EXISTS player_action_log;
    DROP TABLE IF EXISTS player_room_overrides;
    DROP TABLE IF EXISTS player_action_state;
    DROP TABLE IF EXISTS player_position;
    DROP TABLE IF EXISTS world_room_item_spawns;
    DROP TABLE IF EXISTS world_room_npc_spawns;
    DROP TABLE IF EXISTS world_room_exits;
  `)
};
