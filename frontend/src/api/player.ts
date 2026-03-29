import { apiFetch } from './client'

export async function getPlayerState() {
  return apiFetch('/player/state')
}

export async function savePlayerState() {
  return apiFetch('/player/state', { method: 'POST' })
}
