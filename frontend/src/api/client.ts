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

function getCandidateApiUrls(configuredUrl: string): string[] {
  const urls = [configuredUrl]

  try {
    const parsed = new URL(configuredUrl)
    const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
    if (!isLocalHost) return urls

    if (parsed.port === '3000') {
      parsed.port = '3001'
      urls.push(parsed.toString().replace(/\/$/, ''))
    } else if (parsed.port === '3001') {
      parsed.port = '3000'
      urls.push(parsed.toString().replace(/\/$/, ''))
    }
  } catch {
    // Ignore URL parse errors and keep original configured URL.
  }

  return urls
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
  const candidateApiUrls = getCandidateApiUrls(apiUrl)
  const token = getToken()

  let lastNetworkError: unknown = null
  for (const baseUrl of candidateApiUrls) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
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
    } catch (err) {
      // Only retry alternate local URL when it is a network-level fetch failure.
      if (err instanceof TypeError) {
        lastNetworkError = err
        continue
      }
      throw err
    }
  }

  throw (lastNetworkError ?? new Error('無法連接伺服器，請確認後端服務已啟動。'))
}
