import pg from 'pg'

const START_ROOM = '/d/city/kedian'
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://xkx:xkx_dev_pass@localhost:5432/xkx_game'

const { Pool } = pg
const pool = new Pool({ connectionString: DATABASE_URL })

async function main() {
  const totalRooms = Number((await pool.query('SELECT count(*)::int AS n FROM world_rooms')).rows[0]?.n ?? 0)

  const reachableRows = await pool.query(
    `WITH RECURSIVE walk(room_id) AS (
       SELECT $1::text
       UNION
       SELECT e.to_room_id
       FROM walk w
       JOIN world_room_exits e ON e.from_room_id = w.room_id
       JOIN world_rooms r ON r.id = e.to_room_id
     )
     SELECT count(DISTINCT room_id)::int AS n
     FROM walk`,
    [START_ROOM]
  )
  const reachableRooms = Number(reachableRows.rows[0]?.n ?? 0)

  const unreachableByDomainRows = await pool.query(
    `WITH RECURSIVE walk(room_id) AS (
       SELECT $1::text
       UNION
       SELECT e.to_room_id
       FROM walk w
       JOIN world_room_exits e ON e.from_room_id = w.room_id
       JOIN world_rooms r ON r.id = e.to_room_id
     ), uniq AS (
       SELECT DISTINCT room_id FROM walk
     ), unreachable AS (
       SELECT r.id,
              split_part(trim(leading '/' from r.id), '/', 2) AS domain
       FROM world_rooms r
       LEFT JOIN uniq u ON u.room_id = r.id
       WHERE u.room_id IS NULL
     )
     SELECT domain, count(*)::int AS rooms
     FROM unreachable
     GROUP BY domain
     ORDER BY rooms DESC, domain`
    ,
    [START_ROOM]
  )

  const unreachableSampleRows = await pool.query(
    `WITH RECURSIVE walk(room_id) AS (
       SELECT $1::text
       UNION
       SELECT e.to_room_id
       FROM walk w
       JOIN world_room_exits e ON e.from_room_id = w.room_id
       JOIN world_rooms r ON r.id = e.to_room_id
     ), uniq AS (
       SELECT DISTINCT room_id FROM walk
     ), unreachable AS (
       SELECT r.id
       FROM world_rooms r
       LEFT JOIN uniq u ON u.room_id = r.id
       WHERE u.room_id IS NULL
     )
     SELECT u.id,
            COALESCE((wr.data->>'short')::text, '') AS short,
            COALESCE(ideg.cnt, 0)::int AS in_degree,
            COALESCE(odeg.cnt, 0)::int AS out_degree
     FROM unreachable u
     LEFT JOIN world_rooms wr ON wr.id = u.id
     LEFT JOIN (
       SELECT to_room_id, count(*) AS cnt
       FROM world_room_exits
       GROUP BY to_room_id
     ) ideg ON ideg.to_room_id = u.id
     LEFT JOIN (
       SELECT from_room_id, count(*) AS cnt
       FROM world_room_exits
       GROUP BY from_room_id
     ) odeg ON odeg.from_room_id = u.id
     ORDER BY in_degree DESC, out_degree DESC, u.id
     LIMIT 40`,
    [START_ROOM]
  )

  const noEdgeRows = await pool.query(
    `WITH RECURSIVE walk(room_id) AS (
       SELECT $1::text
       UNION
       SELECT e.to_room_id
       FROM walk w
       JOIN world_room_exits e ON e.from_room_id = w.room_id
       JOIN world_rooms r ON r.id = e.to_room_id
     ), uniq AS (
       SELECT DISTINCT room_id FROM walk
     ), unreachable AS (
       SELECT r.id
       FROM world_rooms r
       LEFT JOIN uniq u ON u.room_id = r.id
       WHERE u.room_id IS NULL
     ), deg AS (
       SELECT u.id,
              COALESCE(ideg.cnt, 0)::int AS in_degree,
              COALESCE(odeg.cnt, 0)::int AS out_degree
       FROM unreachable u
       LEFT JOIN (
         SELECT to_room_id, count(*) AS cnt
         FROM world_room_exits
         GROUP BY to_room_id
       ) ideg ON ideg.to_room_id = u.id
       LEFT JOIN (
         SELECT from_room_id, count(*) AS cnt
         FROM world_room_exits
         GROUP BY from_room_id
       ) odeg ON odeg.from_room_id = u.id
     )
     SELECT
       count(*) FILTER (WHERE in_degree = 0 AND out_degree = 0)::int AS isolated,
       count(*) FILTER (WHERE in_degree > 0 OR out_degree > 0)::int AS connected_component_unreachable
     FROM deg`,
    [START_ROOM]
  )

  const noEdge = noEdgeRows.rows[0] ?? { isolated: 0, connected_component_unreachable: 0 }

  const report = {
    startRoom: START_ROOM,
    totalRooms,
    reachableRooms,
    unreachableRooms: totalRooms - reachableRooms,
    isolatedUnreachableRooms: Number(noEdge.isolated ?? 0),
    unreachableWithEdges: Number(noEdge.connected_component_unreachable ?? 0),
    unreachableByDomain: unreachableByDomainRows.rows,
    sampleUnreachable: unreachableSampleRows.rows,
  }

  console.log(JSON.stringify(report, null, 2))
}

main()
  .catch((err) => {
    console.error('Connectivity audit failed:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
