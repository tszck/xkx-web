#!/usr/bin/env bash
set -e

echo "=== xkx-web Setup ==="

# 1. Install Node dependencies
echo "[1/5] Installing npm dependencies..."
npm install

# 2. Copy env file
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "[2/5] Created backend/.env — edit DATABASE_URL before continuing"
  echo "      Default: postgresql://xkx:password@localhost:5432/xkx_game"
else
  echo "[2/5] backend/.env already exists"
fi

# 3. Create PostgreSQL database and user (run as postgres superuser or adjust)
echo "[3/5] Setting up PostgreSQL..."
if command -v psql &>/dev/null; then
  psql -U postgres -c "CREATE USER xkx WITH PASSWORD 'password';" 2>/dev/null || true
  psql -U postgres -c "CREATE DATABASE xkx_game OWNER xkx;" 2>/dev/null || true
  echo "      Database xkx_game created (or already exists)"
else
  echo "      psql not found — create the database manually then re-run"
fi

# 4. Run DB migrations
echo "[4/5] Running database migrations..."
cd backend && DATABASE_URL="$(grep DATABASE_URL .env | cut -d= -f2-)" npx node-pg-migrate -m src/db/migrations up; cd ..

# 5. Run data migration (LPC → JSON) if xkx source exists
XKX_SRC="/root/projects/xkx"
if [ -d "$XKX_SRC/d/city" ]; then
  echo "[5/5] Migrating game data from LPC source..."
  mkdir -p backend/src/data/{rooms,npcs,items,skills}
  cd backend
  npx tsx tools/parse-rooms.ts "$XKX_SRC" src/data/rooms
  npx tsx tools/parse-npcs.ts  "$XKX_SRC" src/data/npcs
  npx tsx tools/parse-skills.ts "$XKX_SRC" src/data/skills
  npx tsx tools/parse-items.ts  "$XKX_SRC" src/data/items
  cd ..
  echo "      Game data migrated to backend/src/data/"
else
  echo "[5/5] LPC source not found at $XKX_SRC — skipping data migration"
fi

echo ""
echo "=== Setup complete ==="
echo "  Dev:        npm run dev:backend  (in one terminal)"
echo "              npm run dev:frontend (in another terminal)"
echo "  Production: cd backend && npm run build && pm2 start ecosystem.config.js"
