import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import * as api from './api'
import type {
  AppState,
  Boot,
  ReminderSettings,
  ServiceLog,
  ServiceType,
  Ski,
  UsageLog,
} from './types'

type GearId = string

const defaultState: AppState = {
  skis: [],
  boots: [],
  usageLogs: [],
  serviceLogs: [],
  reminders: {
    waxEveryDaysUsed: 5,
    checkServiceEveryDays: 30,
  },
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

function App() {
  const [state, setState] = useState<AppState>(defaultState)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [banner, setBanner] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [skiForm, setSkiForm] = useState({ name: '', brand: '', lengthCm: '180' })
  const [bootForm, setBootForm] = useState({ name: '', flex: '110' })
  const [usageForm, setUsageForm] = useState({
    date: todayString(),
    skiId: '',
    bootId: '',
    resort: '',
    weather: '',
    snow: '',
    notes: '',
  })
  const [serviceForm, setServiceForm] = useState({
    date: todayString(),
    skiId: '',
    type: 'wax' as ServiceType,
    details: '',
  })
  const [editingUsageId, setEditingUsageId] = useState<string | null>(null)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [reminderDraft, setReminderDraft] = useState<ReminderSettings>(defaultState.reminders)

  const refresh = useCallback(async () => {
    const data = await api.fetchBootstrap()
    setState(data)
  }, [])

  useEffect(() => {
    setReminderDraft(state.reminders)
  }, [state.reminders])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        await refresh()
        if (alive) {
          setLoadState('ready')
          setBanner(null)
        }
      } catch (e) {
        if (alive) {
          setLoadState('error')
          setBanner(e instanceof Error ? e.message : 'Could not reach the API.')
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [refresh])

  async function withBusy(fn: () => Promise<unknown>): Promise<void> {
    setBusy(true)
    setBanner(null)
    try {
      await fn()
      await refresh()
      setLoadState('ready')
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Request failed.')
    } finally {
      setBusy(false)
    }
  }

  async function retryLoad(): Promise<void> {
    setLoadState('loading')
    setBanner(null)
    setBusy(true)
    try {
      await refresh()
      setLoadState('ready')
    } catch (e) {
      setLoadState('error')
      setBanner(e instanceof Error ? e.message : 'Could not reach the API.')
    } finally {
      setBusy(false)
    }
  }

  const skiNameById = useMemo(
    () => new Map(state.skis.map((ski) => [ski.id, `${ski.brand} ${ski.name}`])),
    [state.skis],
  )
  const bootNameById = useMemo(
    () => new Map(state.boots.map((boot) => [boot.id, `${boot.name} (Flex ${boot.flex})`])),
    [state.boots],
  )

  const usageBySki = useMemo(() => {
    const counts = new Map<GearId, number>()
    for (const log of state.usageLogs) {
      counts.set(log.skiId, (counts.get(log.skiId) ?? 0) + 1)
    }
    return counts
  }, [state.usageLogs])

  const latestServiceBySki = useMemo(() => {
    const latest = new Map<GearId, ServiceLog>()
    const sorted = [...state.serviceLogs].sort((a, b) => b.date.localeCompare(a.date))
    for (const log of sorted) {
      if (!latest.has(log.skiId)) latest.set(log.skiId, log)
    }
    return latest
  }, [state.serviceLogs])

  const latestWaxBySki = useMemo(() => {
    const latest = new Map<GearId, ServiceLog>()
    const sorted = [...state.serviceLogs].sort((a, b) => b.date.localeCompare(a.date))
    for (const log of sorted) {
      if (log.type === 'wax' && !latest.has(log.skiId)) latest.set(log.skiId, log)
    }
    return latest
  }, [state.serviceLogs])

  async function addSki(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!skiForm.name.trim() || !skiForm.brand.trim()) return
    await withBusy(() =>
      api.createSki({
        name: skiForm.name.trim(),
        brand: skiForm.brand.trim(),
        lengthCm: Number(skiForm.lengthCm) || 0,
      }),
    )
    setSkiForm({ name: '', brand: '', lengthCm: '180' })
  }

  async function addBoot(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!bootForm.name.trim()) return
    await withBusy(() =>
      api.createBoot({
        name: bootForm.name.trim(),
        flex: Number(bootForm.flex) || 100,
      }),
    )
    setBootForm({ name: '', flex: '110' })
  }

  async function addUsage(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!usageForm.skiId || !usageForm.bootId || !usageForm.date || !usageForm.resort.trim()) {
      return
    }

    const payload = {
      date: usageForm.date,
      skiId: usageForm.skiId,
      bootId: usageForm.bootId,
      resort: usageForm.resort.trim(),
      conditions: {
        weather: usageForm.weather.trim(),
        snow: usageForm.snow.trim(),
        notes: usageForm.notes.trim(),
      },
    }

    await withBusy(async () => {
      if (editingUsageId) {
        await api.updateUsageLog(editingUsageId, payload)
      } else {
        await api.createUsageLog(payload)
      }
    })

    setUsageForm({
      date: todayString(),
      skiId: '',
      bootId: '',
      resort: '',
      weather: '',
      snow: '',
      notes: '',
    })
    setEditingUsageId(null)
  }

  async function addService(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!serviceForm.skiId || !serviceForm.date) return

    const payload = {
      date: serviceForm.date,
      skiId: serviceForm.skiId,
      type: serviceForm.type,
      details: serviceForm.details.trim(),
    }

    await withBusy(async () => {
      if (editingServiceId) {
        await api.updateServiceLog(editingServiceId, payload)
      } else {
        await api.createServiceLog(payload)
      }
    })

    setServiceForm({
      date: todayString(),
      skiId: '',
      type: 'wax',
      details: '',
    })
    setEditingServiceId(null)
  }

  function beginUsageEdit(log: UsageLog): void {
    setEditingUsageId(log.id)
    setUsageForm({
      date: log.date,
      skiId: log.skiId,
      bootId: log.bootId,
      resort: log.resort,
      weather: log.conditions.weather,
      snow: log.conditions.snow,
      notes: log.conditions.notes,
    })
  }

  function cancelUsageEdit(): void {
    setEditingUsageId(null)
    setUsageForm({
      date: todayString(),
      skiId: '',
      bootId: '',
      resort: '',
      weather: '',
      snow: '',
      notes: '',
    })
  }

  async function deleteUsageLog(id: string): Promise<void> {
    await withBusy(() => api.deleteUsageLog(id))
    if (editingUsageId === id) cancelUsageEdit()
  }

  function beginServiceEdit(log: ServiceLog): void {
    setEditingServiceId(log.id)
    setServiceForm({
      date: log.date,
      skiId: log.skiId,
      type: log.type,
      details: log.details,
    })
  }

  function cancelServiceEdit(): void {
    setEditingServiceId(null)
    setServiceForm({
      date: todayString(),
      skiId: '',
      type: 'wax',
      details: '',
    })
  }

  async function deleteServiceLog(id: string): Promise<void> {
    await withBusy(() => api.deleteServiceLog(id))
    if (editingServiceId === id) cancelServiceEdit()
  }

  function daysSince(date: string): number {
    const now = new Date()
    const then = new Date(date)
    const diffMs = now.getTime() - then.getTime()
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  }

  function usageSinceDate(skiId: string, date: string | null): number {
    return state.usageLogs.filter((log) => log.skiId === skiId && (!date || log.date > date)).length
  }

  if (loadState === 'loading') {
    return (
      <main className="app-shell">
        <p>Loading your quiver…</p>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header>
        <h1>Ski Quiver Tracker</h1>
        <p>Track ski days, boots used, and maintenance history. Data is stored in MongoDB via the API.</p>
      </header>

      {(loadState === 'error' || banner) && (
        <div className="banner error" role="alert">
          <span>
            {loadState === 'error'
              ? 'Cannot reach the API. Start MongoDB, run the server (`npm run dev:server`), and retry.'
              : banner}
          </span>
          <button type="button" className="secondary" onClick={() => retryLoad()} disabled={busy}>
            Retry
          </button>
        </div>
      )}

      <section className="grid two">
        <article className="card">
          <h2>Add Ski</h2>
          <form className="form-stack" onSubmit={(e) => void addSki(e)}>
            <label>
              Model
              <input
                value={skiForm.name}
                onChange={(event) => setSkiForm({ ...skiForm, name: event.target.value })}
                placeholder="M-Free 108"
                required
              />
            </label>
            <label>
              Brand
              <input
                value={skiForm.brand}
                onChange={(event) => setSkiForm({ ...skiForm, brand: event.target.value })}
                placeholder="Dynastar"
                required
              />
            </label>
            <label>
              Length (cm)
              <input
                type="number"
                min={120}
                max={210}
                value={skiForm.lengthCm}
                onChange={(event) => setSkiForm({ ...skiForm, lengthCm: event.target.value })}
              />
            </label>
            <button type="submit" disabled={busy}>
              Add Ski
            </button>
          </form>
        </article>

        <article className="card">
          <h2>Add Boot</h2>
          <form className="form-stack" onSubmit={(e) => void addBoot(e)}>
            <label>
              Model
              <input
                value={bootForm.name}
                onChange={(event) => setBootForm({ ...bootForm, name: event.target.value })}
                placeholder="Hawx Prime"
                required
              />
            </label>
            <label>
              Flex
              <input
                type="number"
                min={70}
                max={150}
                value={bootForm.flex}
                onChange={(event) => setBootForm({ ...bootForm, flex: event.target.value })}
              />
            </label>
            <button type="submit" disabled={busy}>
              Add Boot
            </button>
          </form>
        </article>
      </section>

      <section className="grid two">
        <article className="card">
          <h2>{editingUsageId ? 'Edit Ski Day' : 'Log Ski Day'}</h2>
          <form className="form-stack" onSubmit={(e) => void addUsage(e)}>
            <label>
              Date
              <input
                type="date"
                value={usageForm.date}
                onChange={(event) => setUsageForm({ ...usageForm, date: event.target.value })}
                required
              />
            </label>
            <label>
              Ski
              <select
                value={usageForm.skiId}
                onChange={(event) => setUsageForm({ ...usageForm, skiId: event.target.value })}
                required
              >
                <option value="">Select ski</option>
                {state.skis.map((ski: Ski) => (
                  <option key={ski.id} value={ski.id}>
                    {ski.brand} {ski.name} ({ski.lengthCm}cm)
                  </option>
                ))}
              </select>
            </label>
            <label>
              Boot
              <select
                value={usageForm.bootId}
                onChange={(event) => setUsageForm({ ...usageForm, bootId: event.target.value })}
                required
              >
                <option value="">Select boot</option>
                {state.boots.map((boot: Boot) => (
                  <option key={boot.id} value={boot.id}>
                    {boot.name} (Flex {boot.flex})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Resort / Area
              <input
                value={usageForm.resort}
                onChange={(event) => setUsageForm({ ...usageForm, resort: event.target.value })}
                placeholder="Arapahoe Basin"
                required
              />
            </label>
            <label>
              Weather
              <input
                value={usageForm.weather}
                onChange={(event) => setUsageForm({ ...usageForm, weather: event.target.value })}
                placeholder="Light snow, windy"
              />
            </label>
            <label>
              Snow Conditions
              <input
                value={usageForm.snow}
                onChange={(event) => setUsageForm({ ...usageForm, snow: event.target.value })}
                placeholder="Powder, chopped, groomers"
              />
            </label>
            <label>
              Notes
              <textarea
                rows={3}
                value={usageForm.notes}
                onChange={(event) => setUsageForm({ ...usageForm, notes: event.target.value })}
                placeholder="Legs felt great, deep on upper mountain."
              />
            </label>
            <button type="submit" disabled={busy || state.skis.length === 0 || state.boots.length === 0}>
              {editingUsageId ? 'Update Ski Day' : 'Save Ski Day'}
            </button>
            {editingUsageId && (
              <button type="button" className="secondary" onClick={cancelUsageEdit} disabled={busy}>
                Cancel Edit
              </button>
            )}
          </form>
        </article>

        <article className="card">
          <h2>{editingServiceId ? 'Edit Service' : 'Log Service'}</h2>
          <form className="form-stack" onSubmit={(e) => void addService(e)}>
            <label>
              Date
              <input
                type="date"
                value={serviceForm.date}
                onChange={(event) => setServiceForm({ ...serviceForm, date: event.target.value })}
                required
              />
            </label>
            <label>
              Ski
              <select
                value={serviceForm.skiId}
                onChange={(event) => setServiceForm({ ...serviceForm, skiId: event.target.value })}
                required
              >
                <option value="">Select ski</option>
                {state.skis.map((ski: Ski) => (
                  <option key={ski.id} value={ski.id}>
                    {ski.brand} {ski.name} ({ski.lengthCm}cm)
                  </option>
                ))}
              </select>
            </label>
            <label>
              Service Type
              <select
                value={serviceForm.type}
                onChange={(event) =>
                  setServiceForm({ ...serviceForm, type: event.target.value as ServiceType })
                }
              >
                <option value="wax">Wax</option>
                <option value="repair">Repair</option>
                <option value="edge">Edge Tune</option>
              </select>
            </label>
            <label>
              Details
              <textarea
                rows={3}
                value={serviceForm.details}
                onChange={(event) => setServiceForm({ ...serviceForm, details: event.target.value })}
                placeholder="Hot wax + minor P-tex on tail."
              />
            </label>
            <button type="submit" disabled={busy || state.skis.length === 0}>
              {editingServiceId ? 'Update Service Record' : 'Save Service Record'}
            </button>
            {editingServiceId && (
              <button type="button" className="secondary" onClick={cancelServiceEdit} disabled={busy}>
                Cancel Edit
              </button>
            )}
          </form>
        </article>
      </section>

      <section className="card">
        <h2>Reminder Settings</h2>
        <div className="grid two">
          <label>
            Wax reminder after this many ski days
            <input
              type="number"
              min={1}
              value={reminderDraft.waxEveryDaysUsed}
              onChange={(event) =>
                setReminderDraft((prev) => ({
                  ...prev,
                  waxEveryDaysUsed: Math.max(1, Number(event.target.value) || 1),
                }))
              }
              disabled={busy}
            />
          </label>
          <label>
            Service check reminder after this many days
            <input
              type="number"
              min={1}
              value={reminderDraft.checkServiceEveryDays}
              onChange={(event) =>
                setReminderDraft((prev) => ({
                  ...prev,
                  checkServiceEveryDays: Math.max(1, Number(event.target.value) || 1),
                }))
              }
              disabled={busy}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            void withBusy(() =>
              api.patchSettings({
                waxEveryDaysUsed: reminderDraft.waxEveryDaysUsed,
                checkServiceEveryDays: reminderDraft.checkServiceEveryDays,
              }),
            )
          }
        >
          Save reminder settings
        </button>
      </section>

      <section className="card">
        <h2>Quiver Summary</h2>
        <div className="summary-grid">
          {state.skis.length === 0 && <p>No skis yet. Add your first ski above.</p>}
          {state.skis.map((ski) => {
            const days = usageBySki.get(ski.id) ?? 0
            const latestService = latestServiceBySki.get(ski.id)
            const latestWax = latestWaxBySki.get(ski.id)
            const daysSinceService = latestService ? daysSince(latestService.date) : null
            const daysSinceWaxCount = usageSinceDate(ski.id, latestWax?.date ?? null)
            const waxDue = daysSinceWaxCount >= state.reminders.waxEveryDaysUsed
            const serviceCheckDue =
              daysSinceService !== null && daysSinceService >= state.reminders.checkServiceEveryDays
            return (
              <div key={ski.id} className="summary-item">
                <h3>
                  {ski.brand} {ski.name}
                </h3>
                <p>{ski.lengthCm} cm</p>
                <p>
                  <strong>Days used:</strong> {days}
                </p>
                <p>
                  <strong>Last service:</strong>{' '}
                  {latestService
                    ? `${latestService.date} (${latestService.type})`
                    : 'No service records yet'}
                </p>
                <p className={waxDue ? 'warning' : ''}>
                  <strong>Wax status:</strong>{' '}
                  {latestWax
                    ? waxDue
                      ? `Due (${daysSinceWaxCount} days since last wax)`
                      : `OK (${daysSinceWaxCount} days since last wax)`
                    : 'No wax logged yet'}
                </p>
                <p className={serviceCheckDue ? 'warning' : ''}>
                  <strong>Service check:</strong>{' '}
                  {daysSinceService === null
                    ? 'No service logged yet'
                    : serviceCheckDue
                      ? `Due (${daysSinceService} days)`
                      : `OK (${daysSinceService} days)`}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid two">
        <article className="card">
          <h2>Recent Usage</h2>
          <ul className="timeline">
            {state.usageLogs.length === 0 && <li>No days logged yet.</li>}
            {[...state.usageLogs]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 12)
              .map((log) => (
                <li key={log.id}>
                  <div>
                    <strong>{log.date}</strong> at {log.resort}
                  </div>
                  <div>
                    {skiNameById.get(log.skiId)} with {bootNameById.get(log.bootId)}
                  </div>
                  <div>
                    Conditions: {log.conditions.weather || 'n/a'} | {log.conditions.snow || 'n/a'}
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => beginUsageEdit(log)}
                      disabled={busy}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void deleteUsageLog(log.id)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </article>

        <article className="card">
          <h2>Recent Maintenance</h2>
          <ul className="timeline">
            {state.serviceLogs.length === 0 && <li>No service records yet.</li>}
            {[...state.serviceLogs]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 12)
              .map((log) => (
                <li key={log.id}>
                  <div>
                    <strong>{log.date}</strong> - {log.type}
                  </div>
                  <div>{skiNameById.get(log.skiId)}</div>
                  <div>{log.details || 'No details provided'}</div>
                  <div className="actions">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => beginServiceEdit(log)}
                      disabled={busy}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => void deleteServiceLog(log.id)}
                      disabled={busy}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </article>
      </section>
    </main>
  )
}

export default App
