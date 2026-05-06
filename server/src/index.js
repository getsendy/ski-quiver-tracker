import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import mongoose from 'mongoose'

const PORT = Number(process.env.PORT) || 8787
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ski-quiver-tracker'

/** Explicit collection names so Atlas “Browse Collections” is easy to read. */
const COLLECTIONS = {
  skis: 'ski_quiver_skis',
  boots: 'ski_quiver_boots',
  dayLogs: 'ski_quiver_day_logs',
  maintenanceLogs: 'ski_quiver_maintenance_logs',
  settings: 'ski_quiver_settings',
}

const SkiSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    brand: { type: String, required: true },
    lengthCm: { type: Number, required: true },
  },
  { timestamps: true, collection: COLLECTIONS.skis },
)

const BootSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    flex: { type: Number, required: true },
  },
  { timestamps: true, collection: COLLECTIONS.boots },
)

const UsageLogSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    skiId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ski', required: true },
    bootId: { type: mongoose.Schema.Types.ObjectId, ref: 'Boot', required: true },
    resort: { type: String, required: true },
    conditions: {
      weather: { type: String, default: '' },
      snow: { type: String, default: '' },
      notes: { type: String, default: '' },
    },
  },
  { timestamps: true, collection: COLLECTIONS.dayLogs },
)

const ServiceLogSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    skiId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ski', required: true },
    type: { type: String, enum: ['wax', 'repair', 'edge'], required: true },
    details: { type: String, default: '' },
  },
  { timestamps: true, collection: COLLECTIONS.maintenanceLogs },
)

const SettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'default' },
    waxEveryDaysUsed: { type: Number, default: 5 },
    checkServiceEveryDays: { type: Number, default: 30 },
  },
  { collection: COLLECTIONS.settings },
)

const Ski = mongoose.model('Ski', SkiSchema)
const Boot = mongoose.model('Boot', BootSchema)
const UsageLog = mongoose.model('UsageLog', UsageLogSchema)
const ServiceLog = mongoose.model('ServiceLog', ServiceLogSchema)
const Settings = mongoose.model('Settings', SettingsSchema)

function id(doc) {
  return doc._id.toString()
}

function mapSki(doc) {
  return { id: id(doc), name: doc.name, brand: doc.brand, lengthCm: doc.lengthCm }
}

function mapBoot(doc) {
  return { id: id(doc), name: doc.name, flex: doc.flex }
}

function mapUsage(doc) {
  return {
    id: id(doc),
    date: doc.date,
    skiId: doc.skiId.toString(),
    bootId: doc.bootId.toString(),
    resort: doc.resort,
    conditions: doc.conditions || { weather: '', snow: '', notes: '' },
  }
}

function mapService(doc) {
  return {
    id: id(doc),
    date: doc.date,
    skiId: doc.skiId.toString(),
    type: doc.type,
    details: doc.details || '',
  }
}

async function getOrCreateSettings() {
  let s = await Settings.findById('default').lean()
  if (!s) {
    await Settings.create({ _id: 'default', waxEveryDaysUsed: 5, checkServiceEveryDays: 30 })
    s = await Settings.findById('default').lean()
  }
  return {
    waxEveryDaysUsed: s.waxEveryDaysUsed ?? 5,
    checkServiceEveryDays: s.checkServiceEveryDays ?? 30,
  }
}

async function buildBootstrap() {
  const [skis, boots, usageLogs, serviceLogs, reminders] = await Promise.all([
    Ski.find().sort({ createdAt: -1 }).lean(),
    Boot.find().sort({ createdAt: -1 }).lean(),
    UsageLog.find().sort({ date: -1 }).lean(),
    ServiceLog.find().sort({ date: -1 }).lean(),
    getOrCreateSettings(),
  ])

  return {
    skis: skis.map((d) => mapSki(d)),
    boots: boots.map((d) => mapBoot(d)),
    usageLogs: usageLogs.map((d) => mapUsage(d)),
    serviceLogs: serviceLogs.map((d) => mapService(d)),
    reminders,
  }
}

const app = express()
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
)
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({
    name: 'ski-quiver-tracker API',
    endpoints: {
      health: 'GET /health',
      bootstrap: 'GET /api/bootstrap',
    },
    ui:
      'This server is API-only. Run `npm run dev` in the project root and open the Local URL (e.g. http://localhost:5173).',
  })
})

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/bootstrap', async (_req, res) => {
  try {
    const data = await buildBootstrap()
    res.json(data)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'bootstrap_failed' })
  }
})

app.post('/api/skis', async (req, res) => {
  try {
    const { name, brand, lengthCm } = req.body
    const doc = await Ski.create({
      name: String(name).trim(),
      brand: String(brand).trim(),
      lengthCm: Number(lengthCm) || 0,
    })
    res.status(201).json(mapSki(doc))
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: 'invalid_ski' })
  }
})

app.post('/api/boots', async (req, res) => {
  try {
    const { name, flex } = req.body
    const doc = await Boot.create({
      name: String(name).trim(),
      flex: Number(flex) || 100,
    })
    res.status(201).json(mapBoot(doc))
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: 'invalid_boot' })
  }
})

app.post('/api/usage-logs', async (req, res) => {
  try {
    const { date, skiId, bootId, resort, conditions } = req.body
    const doc = await UsageLog.create({
      date,
      skiId,
      bootId,
      resort: String(resort).trim(),
      conditions: conditions || {},
    })
    res.status(201).json(mapUsage(doc))
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: 'invalid_usage' })
  }
})

app.patch('/api/usage-logs/:logId', async (req, res) => {
  try {
    const { date, skiId, bootId, resort, conditions } = req.body
    const doc = await UsageLog.findByIdAndUpdate(
      req.params.logId,
      {
        ...(date !== undefined ? { date } : {}),
        ...(skiId !== undefined ? { skiId } : {}),
        ...(bootId !== undefined ? { bootId } : {}),
        ...(resort !== undefined ? { resort: String(resort).trim() } : {}),
        ...(conditions !== undefined ? { conditions } : {}),
      },
      { new: true },
    ).lean()
    if (!doc) return res.status(404).json({ error: 'not_found' })
    res.json(mapUsage(doc))
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: 'update_failed' })
  }
})

app.delete('/api/usage-logs/:logId', async (req, res) => {
  try {
    const r = await UsageLog.findByIdAndDelete(req.params.logId)
    if (!r) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: 'delete_failed' })
  }
})

app.post('/api/service-logs', async (req, res) => {
  try {
    const { date, skiId, type, details } = req.body
    const doc = await ServiceLog.create({
      date,
      skiId,
      type,
      details: String(details ?? '').trim(),
    })
    res.status(201).json(mapService(doc))
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: 'invalid_service' })
  }
})

app.patch('/api/service-logs/:logId', async (req, res) => {
  try {
    const { date, skiId, type, details } = req.body
    const doc = await ServiceLog.findByIdAndUpdate(
      req.params.logId,
      {
        ...(date !== undefined ? { date } : {}),
        ...(skiId !== undefined ? { skiId } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(details !== undefined ? { details: String(details).trim() } : {}),
      },
      { new: true },
    ).lean()
    if (!doc) return res.status(404).json({ error: 'not_found' })
    res.json(mapService(doc))
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: 'update_failed' })
  }
})

app.delete('/api/service-logs/:logId', async (req, res) => {
  try {
    const r = await ServiceLog.findByIdAndDelete(req.params.logId)
    if (!r) return res.status(404).json({ error: 'not_found' })
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: 'delete_failed' })
  }
})

app.patch('/api/settings', async (req, res) => {
  try {
    const { waxEveryDaysUsed, checkServiceEveryDays } = req.body
    await Settings.findByIdAndUpdate(
      'default',
      {
        ...(waxEveryDaysUsed !== undefined
          ? { waxEveryDaysUsed: Math.max(1, Number(waxEveryDaysUsed) || 1) }
          : {}),
        ...(checkServiceEveryDays !== undefined
          ? { checkServiceEveryDays: Math.max(1, Number(checkServiceEveryDays) || 1) }
          : {}),
      },
      { upsert: true, new: true },
    ).lean()
    const reminders = await getOrCreateSettings()
    res.json(reminders)
  } catch (err) {
    console.error(err)
    res.status(400).json({ error: 'settings_failed' })
  }
})

async function main() {
  await mongoose.connect(MONGODB_URI)
  console.log(
    `MongoDB connected: database="${mongoose.connection.name}" (confirm this matches Atlas Data Explorer)`,
  )
  app.listen(PORT, () => {
    console.log(`Ski quiver API listening on http://localhost:${PORT}`)
    console.log(`MongoDB collections: ${Object.values(COLLECTIONS).join(', ')}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
