import type { AppState, ReminderSettings, UsageLog, ServiceLog } from './types'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

export async function fetchBootstrap(): Promise<AppState> {
  const res = await fetch(`${API_BASE}/api/bootstrap`)
  return json<AppState>(res)
}

export async function createSki(body: { name: string; brand: string; lengthCm: number }): Promise<void> {
  const res = await fetch(`${API_BASE}/api/skis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await json(res)
}

export async function createBoot(body: { name: string; flex: number }): Promise<void> {
  const res = await fetch(`${API_BASE}/api/boots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await json(res)
}

export async function createUsageLog(body: Omit<UsageLog, 'id'>): Promise<void> {
  const res = await fetch(`${API_BASE}/api/usage-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await json(res)
}

export async function updateUsageLog(
  id: string,
  body: Partial<Omit<UsageLog, 'id'>>,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/usage-logs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await json(res)
}

export async function deleteUsageLog(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/usage-logs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 204) {
    const text = await res.text()
    throw new Error(text || `Delete failed (${res.status})`)
  }
}

export async function createServiceLog(body: Omit<ServiceLog, 'id'>): Promise<void> {
  const res = await fetch(`${API_BASE}/api/service-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await json(res)
}

export async function updateServiceLog(
  id: string,
  body: Partial<Omit<ServiceLog, 'id'>>,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/service-logs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  await json(res)
}

export async function deleteServiceLog(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/service-logs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 204) {
    const text = await res.text()
    throw new Error(text || `Delete failed (${res.status})`)
  }
}

export async function patchSettings(body: Partial<ReminderSettings>): Promise<ReminderSettings> {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return json<ReminderSettings>(res)
}
