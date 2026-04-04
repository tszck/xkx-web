# Development Plan: Backend DB-First Movement & Actions

## Goal
Migrate core gameplay runtime for character movement and actions from mostly in-memory session state + JSON world lookups to a database-backed model that is consistent, queryable, and extensible for multiplayer-like correctness (while still serving single-player clients).

## Scope
- Backend-first refactor for movement/action persistence and validation.
- Keep existing client protocol stable whenever possible.
- Introduce compatibility layer to avoid frontend breakage during transition.

## Current Baseline
- World definitions now load from PostgreSQL (`WORLD_DATA_SOURCE=db`) with parity validated.
- Player state, inventory, skills, quests already persist in PostgreSQL.
- Movement/action execution is still session-memory heavy (ephemeral room/NPC instances per session).

## Progress Update (2026-04-04)
- Step 1 schema foundations are complete and validated.
- Runtime schema applied via `005_world_runtime_apply.js` (ESM migration) after SQL migration files `003`/`004` were observed as no-op in this environment.
- Validation result: `table_count=8`, `index_count=6` for all required runtime objects.
- Step 2 normalization is complete and validated via `tools/normalize-world-db.ts`.
- Seeded runtime counts: `world_room_exits=273`, `world_room_npc_spawns=3220`, `world_room_item_spawns=0`.
- Sample parity checks passed for 8 rooms; item spawns are currently empty in the source corpus.
- Step 3 DB-authoritative movement is complete and validated via `MovementService`.
- Smoke test result: valid move updated `player_position`, `player_state.current_room`, and `player_action_log`; invalid move kept state unchanged and recorded `NO_EXIT`.
- Step 4 runtime state persistence is complete and validated via reconnect smoke tests.
- Combat state now round-trips through `player_action_state`; room item deltas round-trip through `player_room_overrides`.
- Step 5 tick and action auditing is complete and validated.
- `player_tick_state` advances on tick; accepted actions are written to `player_action_log` in order.
- Data completeness validation passed against the parsed source corpus and the DB-backed runtime loader.
- Source/DB parity: rooms=5600, npcs=1617, items=764, skills=572.
- Runtime parity: exits=273, npc_spawns=3220, item_spawns=0.
- `WorldLoader` now skips non-record JSON like `skills/names.json`, so DB-backed loading reports the same 572 skills as the corpus.

## Target Data Model (Phase A)
### 1. Canonical world graph
- `world_rooms` (already exists; source of room metadata).
- `world_room_exits` (new): normalized edges from room -> room by direction.
- `world_room_npc_spawns` (new): spawn templates and counts per room.
- `world_room_item_spawns` (new): item spawn templates per room.

### 2. Per-player runtime state
- `player_position` (new): authoritative current room + moved_at + revision.
- `player_action_state` (new): current mode (idle/combat/dialog), target refs, cooldown timestamps.
- `player_room_overrides` (new): player-specific room deltas (loot removed, temporary flags).

### 3. Action/event ledger
- `player_action_log` (new append-only): accepted actions and outcomes for replay/debug/audit.
- `player_tick_state` (new): deterministic tick progress and regen/combat scheduling.

## Backend Implementation Plan
### Step 1 — Schema foundations
- Add migration `003_world_runtime.sql` for new normalized world/runtime tables.
- Add indexes for:
  - `(from_room_id, direction)`
  - `(player_id)` on runtime tables
  - `(player_id, created_at desc)` on action log
- Validation:
  - migration applies cleanly
  - table/index existence checks pass

Status: completed via `005_world_runtime_apply.js` with successful introspection checks.

### Step 2 — Seed normalized world edges/spawns
- Add tool `tools/normalize-world-db.ts`:
  - Derive exits from `world_rooms.data.exits` into `world_room_exits`.
  - Derive NPC spawn templates from `world_rooms.data.npcs` + `npcCounts`.
  - Derive item spawn templates from `world_rooms.data.items`.
- Validation:
  - `world_room_exits` count > 0 and matches JSON-derived total
  - sample room exit graph parity checks pass

Status: completed via `tools/normalize-world-db.ts` with parity checks.

### Step 3 — Movement service (DB-authoritative)
- Add `MovementService` with transaction-safe move:
  - Read player current room from `player_position` (fallback to `player_state.current_room` once).
  - Validate exit via `world_room_exits`.
  - Enforce room flags and action-state constraints.
  - Update `player_position` + `player_state.current_room` atomically.
  - Append movement outcome to `player_action_log`.
- Wire `MoveAction` to service.
- Validation:
  - repeated moves persist across reconnects
  - invalid direction returns consistent error without state drift

Status: completed via `MovementService` with successful smoke tests.

### Step 4 — Action-state persistence
- Persist combat/dialog state transitions in `player_action_state`.
- Persist per-player room deltas in `player_room_overrides`.
- Keep `GameSession` as transport/session shell, not source-of-truth for position/action mode.
- Validation:
  - reconnect restores ongoing mode safely
  - server restart does not corrupt movement/action state

Status: completed via runtime state helpers and reconnect smoke tests.

### Step 5 — Tick and action logging
- Introduce tick read/write in `player_tick_state`.
- Log all accepted client actions with compact payload + result code in `player_action_log`.
- Validation:
  - tick continuity and regen correctness in DB snapshots
  - recent action audit query reflects user interactions in order

Status: completed via tick persistence plus action audit logging.

## API/WS Compatibility Contract
### Keep stable first
- Continue emitting current event types:
  - `ROOM_ENTER`, `LOG`, `STAT_UPDATE`, `COMBAT_*`, `DIALOG`, `ERROR`
- Continue accepting current action types:
  - `MOVE`, `ATTACK`, `TALK`, etc.

### Additive changes only (initially)
- Optional fields in `ROOM_ENTER` payload:
  - `roomMeta` / `edgeMeta` / `actionHints` (non-breaking).
- Optional `ERROR.code` standardization for frontend UX mapping.

## Frontend Accommodation Check
### Current frontend assumptions that may need adaptation
- `ExitButtons` currently expects free-form `room.exits` map and is now dynamic-compatible.
- `MiniMap` uses room summaries + coords; DB refactor should preserve `/api/world/rooms` schema.
- Store assumes immediate `ROOM_ENTER` after successful movement.

### Required frontend changes (if backend contract evolves)
- If movement becomes async/queued:
  - add pending-move state and button disable while in-flight.
- If backend adds deterministic failure codes:
  - map `ERROR.code` to localized user-facing hints.
- If room payload introduces action hints:
  - render hints in `ActionBar` and `RoomView`.

### Current verdict
- No mandatory frontend rewrite is needed for Steps 1-3 if payload compatibility is preserved.
- Recommended enhancements: pending-state UX + richer error handling.

## Validation Matrix (execute after each step)
1. Schema migration applies and introspection checks pass.
2. Normalized world tables match source counts/parity samples.
3. Movement persistence survives reconnect and PM2 restart.
4. Action logs are written for move/look/talk/attack paths.
5. Public API parity remains intact (`/api/world/*`, guest flow, WS movement).

## Rollout Strategy
- Feature flag: `WORLD_RUNTIME_SOURCE=legacy|db` (new config key).
- Start with `legacy` default, run shadow writes.
- Switch to `db` after parity checks.
- Keep rollback path by retaining legacy action handlers for one release cycle.
