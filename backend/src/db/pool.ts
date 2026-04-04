import { Pool, type QueryResultRow } from 'pg'
import { config } from '../config'

export const pool = new Pool({ connectionString: config.databaseUrl })

pool.on('error', (err) => {
  console.error('Unexpected DB pool error', err)
})

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]) {
  const result = await pool.query<T>(sql, params)
  return result
}
