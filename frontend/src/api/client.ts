declare const __API_URL__: string

function getConfiguredApiUrl(): string {
  const apiUrl = (__API_URL__ ?? '').trim()
  if (!apiUrl) {
    throw new Error('前端尚未設定 API URL，請在 GitHub repository secrets 中設定 VITE_API_URL。')
  }

  const isGithubPages = typeof window !== 'undefined' && window.location.hostname.endsWith('github.io')
  if (isGithubPages && /localhost|127\.0\.0\.1/.test(apiUrl)) {
    throw new Error('GitHub Pages 前端尚未設定外部 API URL，請設定 VITE_API_URL / VITE_WS_URL。')
  }

  return apiUrl.replace(/\/$/, '')
}

export function getToken(): string | null {
  return localStorage.getItem('xkx_token')
}

export function setToken(token: string) {
  localStorage.setItem('xkx_token', token)
}

export function clearToken() {
  localStorage.removeItem('xkx_token')
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const apiUrl = getConfiguredApiUrl()
  const token = getToken()
  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Session-Token': token } : {}),
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error)
  }
  return res.json() as Promise<T>
}
