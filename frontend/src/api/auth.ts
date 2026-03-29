import { apiFetch, setToken } from './client'

export interface GuestResponse {
  token: string
  playerId: number
  displayName: string
}

export async function createGuestSession(): Promise<GuestResponse> {
  const res = await apiFetch<GuestResponse>('/auth/guest', { method: 'POST' })
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
