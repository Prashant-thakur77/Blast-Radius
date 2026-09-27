const API_KEY_STORAGE = "blastradius-api-key"

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(API_KEY_STORAGE)
}

export function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE, key)
}

export function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE)
}

export async function apiFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const key = getApiKey()
  const headers = new Headers(options?.headers)
  if (key) headers.set("X-API-Key", key)
  if (!headers.has("Content-Type") && options?.body) {
    headers.set("Content-Type", "application/json")
  }

  const res = await fetch(path, { ...options, headers })

  if (res.status === 401 || res.status === 403) {
    clearApiKey()
    if (typeof window !== "undefined") {
      window.location.href = "/setup"
    }
  }

  return res
}
