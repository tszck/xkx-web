export const shorthands = undefined

export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS player_accounts (
      player_id      BIGINT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      username       TEXT NOT NULL UNIQUE,
      password_hash  TEXT NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS player_accounts_username_idx ON player_accounts(username);
  `)
}

export const down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS player_accounts_username_idx;
    DROP TABLE IF EXISTS player_accounts;
  `)
}
