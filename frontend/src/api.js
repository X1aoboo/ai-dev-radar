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

export async function downloadFile(url, filename) {
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new HttpError(response.status, body?.detail ?? `下载失败（${response.status}）`)
  }
  const blob = await response.blob()
  const link = document.createElement('a')
  const objectUrl = URL.createObjectURL(blob)
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}
