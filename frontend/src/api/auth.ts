import { apiFetch, clearToken, setToken } from './client'

export interface GuestResponse {
  token: string
  playerId: number
  displayName: string
}

export interface RegisterPayload {
  username: string
  password: string
  displayName: string
  stats: {
    str: number
    con: number
    dex: number
    int_stat: number
    per: number
    kar: number
    sta: number
    spi: number
  }
}

export async function createGuestSession(): Promise<GuestResponse> {
  const res = await apiFetch<GuestResponse>('/auth/guest', { method: 'POST' })
  setToken(res.token)
  return res
}

export async function registerAccount(payload: RegisterPayload): Promise<GuestResponse> {
  const res = await apiFetch<GuestResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  setToken(res.token)
  return res
}

export async function loginAccount(username: string, password: string): Promise<GuestResponse> {
  const res = await apiFetch<GuestResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setToken(res.token)
  return res
}

export async function getMe(): Promise<GuestResponse | null> {
  try { return await apiFetch<GuestResponse>('/auth/me') }
  catch { return null }
}

export async function renamePlayer(name: string): Promise<{ ok: boolean; displayName: string }> {
  return apiFetch('/auth/rename', { method: 'POST', body: JSON.stringify({ name }) })
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' })
  } finally {
    clearToken()
  }
}
