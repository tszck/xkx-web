import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { query } from '../pool'

interface DBAccount {
  player_id: number
  username: string
  password_hash: string
}

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 64

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString('hex')
  return `scrypt$${salt}$${derived}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [alg, salt, expected] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !expected) return false
  const derived = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString('hex')
  const lhs = Buffer.from(expected, 'hex')
  const rhs = Buffer.from(derived, 'hex')
  return lhs.length === rhs.length && timingSafeEqual(lhs, rhs)
}

export async function createAccount(playerId: number, username: string, password: string) {
  const passwordHash = hashPassword(password)
  await query(
    `INSERT INTO player_accounts (player_id, username, password_hash)
     VALUES ($1, $2, $3)`,
    [playerId, username.toLowerCase(), passwordHash]
  )
}

export async function getAccountByUsername(username: string): Promise<DBAccount | null> {
  const r = await query<DBAccount>(
    `SELECT player_id, username, password_hash
     FROM player_accounts
     WHERE username = $1`,
    [username.toLowerCase()]
  )
  return r.rows[0] ?? null
}

export async function verifyAccountPassword(username: string, password: string): Promise<{ playerId: number } | null> {
  const account = await getAccountByUsername(username)
  if (!account) return null
  if (!verifyPassword(password, account.password_hash)) return null
  return { playerId: account.player_id }
}
