export type GearId = string

export type Ski = {
  id: GearId
  name: string
  brand: string
  lengthCm: number
}

export type Boot = {
  id: GearId
  name: string
  flex: number
}

export type Conditions = {
  weather: string
  snow: string
  notes: string
}

export type UsageLog = {
  id: string
  date: string
  skiId: GearId
  bootId: GearId
  resort: string
  conditions: Conditions
}

export type ServiceType = 'wax' | 'repair' | 'edge'

export type ServiceLog = {
  id: string
  date: string
  skiId: GearId
  type: ServiceType
  details: string
}

export type ReminderSettings = {
  waxEveryDaysUsed: number
  checkServiceEveryDays: number
}

export type AppState = {
  skis: Ski[]
  boots: Boot[]
  usageLogs: UsageLog[]
  serviceLogs: ServiceLog[]
  reminders: ReminderSettings
}
