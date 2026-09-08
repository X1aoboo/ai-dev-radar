export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, { credentials: 'include', ...options })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new HttpError(response.status, body?.detail ?? `请求失败（${response.status}）`)
  }
  if (response.status === 204) return null
  return response.json()
}
