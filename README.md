# 俠客行 Web

A browser-based single-player wuxia RPG converted from the classic [xkx100](https://github.com/MudRen/xkx100) FluffOS MUD.

- **Frontend** — React + TypeScript, hosted on GitHub Pages
- **Backend** — Node.js + WebSocket API, hosted on VPS
- **Database** — PostgreSQL (player save/load)
- **Auth** — Guest accounts with auto-generated wuxia names; customizable later

---

## Quick Start (Development)

### Prerequisites

- Node.js 20+
- PostgreSQL 14+

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit DATABASE_URL if your credentials differ
```

### 3. Set up the database

```bash
# Create DB user and database (once)
sudo -u postgres psql -c "CREATE USER xkx WITH PASSWORD 'xkx_dev_pass';"
sudo -u postgres psql -c "CREATE DATABASE xkx_game OWNER xkx;"

# Run migrations
cd backend
DATABASE_URL=postgresql://xkx:xkx_dev_pass@localhost:5432/xkx_game \
  npx node-pg-migrate -m src/db/migrations up
```

### 4. Migrate game data (LPC → JSON)

Requires the original [xkx100](https://github.com/MudRen/xkx100) source at `../xkx` (or adjust the path):

```bash
cd backend
mkdir -p src/data/{rooms,npcs,items,skills}
npx tsx tools/parse-rooms.ts  ../xkx src/data/rooms   # 5865 rooms
npx tsx tools/parse-npcs.ts   ../xkx src/data/npcs    # 1617 NPCs
npx tsx tools/parse-skills.ts ../xkx src/data/skills  # 572 skills
npx tsx tools/parse-items.ts  ../xkx src/data/items   # 764 items
```

Or just run the setup script which does all of the above:

```bash
bash setup.sh
```

### 5. Run

```bash
# Terminal 1 — backend
npm run dev:backend

# Terminal 2 — frontend
npm run dev:frontend
# → http://localhost:5173
```

---

## Project Structure

```
xkx-web/
├── backend/                    Node.js game server
│   ├── src/
│   │   ├── index.ts            Entry point (Express + WebSocket)
│   │   ├── config.ts           Environment config
│   │   ├── db/                 PostgreSQL pool + queries
│   │   ├── api/                REST endpoints (auth, player, world)
│   │   ├── ws/                 WebSocket server + message handler
│   │   └── engine/
│   │       ├── GameSession.ts  Per-player game loop
│   │       ├── world/          Room + NPC instances, world loader
│   │       ├── player/         PlayerState, Inventory, SkillBook
│   │       ├── combat/         CombatEngine (ported from combatd.c)
│   │       ├── actions/        Move, Attack, Talk, Item, Train
│   │       └── quests/         QuestManager (plug in main quest here)
│   ├── tools/                  One-time LPC → JSON migration scripts
│   └── ecosystem.config.js     PM2 production config
├── frontend/                   React SPA (GitHub Pages)
│   └── src/
│       ├── App.tsx             Root: auth gate → GameLayout
│       ├── ws/                 WebSocket hook + message types
│       ├── api/                fetch wrappers (auth, player, world)
│       ├── store/              Zustand state (game, player, ui)
│       └── components/
│           ├── layout/         3-column panel grid
│           ├── game/           RoomView, ExitButtons, ActionBar, EventLog, CombatHUD
│           ├── player/         StatsPanel, InventoryPanel, SkillPanel, MiniMap
│           ├── npc/            NpcList, NpcDialog (inquiry + shop)
│           └── auth/           GuestWelcome, RenameModal
├── nginx.conf.example          Nginx reverse proxy template
├── deployment_plan.md          Full architecture and rollout plan
└── setup.sh                    One-command dev setup
```

---

## Architecture

```
GitHub Pages (React SPA)
    ↕  REST  (auth, save/load)        https://your-vps/api/
    ↕  WebSocket (game events)        wss://your-vps/ws?token=TOKEN
VPS — Node.js (port 3000)
    ↕
PostgreSQL — player state, skills, inventory, quests
```

### WebSocket protocol

All messages are JSON with a `type` field.

**Client → Server actions:** `MOVE`, `ATTACK`, `FLEE`, `TALK`, `GET_ITEM`, `DROP_ITEM`, `USE_ITEM`, `EQUIP_ITEM`, `LOOK`, `TRAIN_SKILL`, `REST`, `PING`

**Server → Client events:** `ROOM_ENTER`, `LOG`, `COMBAT_START`, `COMBAT_ROUND`, `COMBAT_END`, `STAT_UPDATE`, `INVENTORY_UPDATE`, `DIALOG`, `QUEST_ASSIGNED`, `QUEST_COMPLETE`, `SKILL_UPDATE`, `ERROR`, `TICK`

### Auth flow

1. Browser hits `POST /api/auth/guest` → gets `{ token, playerId, displayName }`
2. Token stored in `localStorage`, sent as `X-Session-Token` header on all API calls
3. WS opened as `ws://host/ws?token=TOKEN`
4. Player state restored from DB on connect; auto-saved every 60s and on disconnect
5. Display name customizable via `POST /api/auth/rename`

---

## Port Allocation

To prevent port conflicts when running multiple projects locally, each server uses a distinct port:

| Project | Server | Port | Environment | Notes |
|---------|--------|------|-------------|-------|
| **xkx-web** | Node.js backend | **3001** | Configured in `.env` and `ecosystem.config.js` | REST + WebSocket API |
| **DND** | Node.js Express | **3000** | Configured in `.env` | Campaign manager (standalone) |
| **Frontend** | Vite dev server | **5173** | Default Vite port | Only used during `npm run dev:frontend` |

**Troubleshooting port conflicts:**

If you get `EADDRINUSE` error (port already in use):

```bash
# Find process on a specific port (e.g., 3001)
lsof -i :3001

# Kill that process
kill -9 <PID>

# Or clean up all PM2 processes and restart
pm2 delete all
pm2 start ecosystem.config.js
```

---

## Production Deployment

### Backend (VPS)

**1. Configure environment**

Copy `.env.example` to `.env` and update for production:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://xkx:password@your-actual-db:5432/xkx_game

# CRITICAL: Set CORS_ORIGIN to your frontend domain
# Multiple origins separated by comma
CORS_ORIGIN=https://tszck.github.io,https://your-custom-domain.com
```

> **CORS Fix:** Without `CORS_ORIGIN` configured, frontend requests from `https://tszck.github.io` will be blocked with "No 'Access-Control-Allow-Origin' header" error.

**2. Build and start backend**

```bash
# Build
cd backend && npm run build

# Start with PM2 (ensures auto-restart on crash/reboot)
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

**3. Verify backend is running**

```bash
# Check status
pm2 status
pm2 logs xkx-backend
```

If you see 502 errors from the reverse proxy (Nginx/Caddy), the backend service crashed. Check logs with `pm2 logs`.

### Reverse Proxy (Nginx or Caddy)

Copy `nginx.conf.example` to `/etc/nginx/sites-available/xkx` and update the domain name and SSL paths. The config proxies `/api/` and `/ws` to `localhost:3000`.

```bash
certbot --nginx -d your-domain.com   # free SSL via Let's Encrypt
nginx -t && systemctl reload nginx
```

**Troubleshooting 502 Bad Gateway:**

If browser shows "502 Bad Gateway" or CORS errors, the backend is not accepting connections:

```bash
# Check if backend is running on port 3000
netstat -tlnp | grep 3000

# If not running, start it
cd /root/projects/xkx-web/backend
pm2 start ecosystem.config.js

# Check logs for errors
pm2 logs xkx-backend
```

Make sure `backend/.env` has `CORS_ORIGIN` configured (see Backend section above).

### Frontend (GitHub Pages)

Push to `main` — GitHub Actions (`.github/workflows/deploy-frontend.yml`) builds with Vite and deploys to the `gh-pages` branch automatically.

Configure these in your repository settings:

| Secret / Variable | Value |
|---|---|
| `VITE_WS_URL` | `wss://your-vps-domain.com/ws` |
| `VITE_API_URL` | `https://your-vps-domain.com/api` |
| `VITE_BASE_PATH` | `/repo-name/` (if not a root Pages site) |

---

## Content Rollout

Game data lives in `backend/src/data/` as JSON. All domains have been imported, normalized, and are ready for gameplay.

### Current Data State (verified 2026-04-04)

- Parsed room JSON: **5865** files
- Parsed NPC JSON: **1617** files
- Database world domains (`world_rooms.domain`): **86** (all imported ✅)
- Exits extracted: **11,916**
- NPC spawn points: **3,230**

### Patch Status

| Patch | Domains | Status |
|---|---|---|
| P1 — Launch | `city` (揚州) | ✅ Live |
| P2 — 江南 | `suzhou`, `hangzhou`, `jiaxing`, `wuxi`, `yixing`, `yueyang`, `fuzhou`, `quanzhou` | ✅ Live (8/8 domains) |
| P3 — 五嶽少林 | `taishan`, `songshan`, `hengshan`, `henshan`, `huashan`, `shaolin`, `nanshaolin` | ✅ Live (7/7 domains) |
| P4 — 道家名派 | `wudang`, `quanzhen`, `emei`, `qingcheng`, `taohua`, `kunlun` | ✅ Live (6/6 domains) |
| P5–P10+ | All remaining domains (59+ total) | ✅ Live (all parsed & imported) |

> **Content Rollout Complete!** All 86 parsed domains are now imported to the database and ready for gameplay. Players can freely explore across all regions. Quest scripting and story content development can now proceed in runtime.

---

## Adding Quests

Plug main quest and side quest logic into `backend/src/engine/quests/QuestManager.ts`:

```typescript
// Assign a quest from an NPC
await questManager.assignQuest(session, 'main_q1', npcInstanceId, '描述文字')

// Complete it on trigger condition
await questManager.completeQuest(session, 'main_q1', '獎勵說明')

// Guard quest-gated dialogue / events
if (await questManager.hasCompleted(session, 'main_q1')) { ... }
```

---

## Known Issues (from original LPC source)

1. Some room long-descriptions have formatting artifacts from the GBK→UTF-8 migration
2. Cross-domain exits are sealed until that domain's content patch is active
3. Emote system stub — `QuestManager` placeholder ready for story content

---

## License

Game content (room descriptions, NPC dialogue, world lore) originates from the xkx100 MUD library. Engine code in this repository is original.
