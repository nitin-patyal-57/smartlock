import { v4 as uuidv4 } from 'uuid'
import { getDb } from './database'

/**
 * SQLite-backed store for the dashboard. The DB is a working cache only:
 * on Render's free tier the filesystem is wiped on every restart, and the
 * browser re-registers its locks via the WebSocket `sync_devices` message.
 */

const ONLINE_WINDOW_MS = 2 * 60 * 1000
const LIST_LIMIT = 200

// IMEIs become MQTT topic segments, so reject anything that could be a wildcard or path separator.
const IMEI_PATTERN = /^[A-Za-z0-9_-]{6,32}$/

export interface DeviceRegistration {
  imei: string
  deviceName?: string
  modelId?: string
}

export interface AlertRecord {
  id: string
  deviceId: string
  type: string
  message: string
  severity: 'critical' | 'warning' | 'info'
  timestamp: string
  acknowledged: boolean
}

export interface ActivityRecord {
  id: string
  deviceId: string
  type: 'lock' | 'unlock' | 'tamper' | 'remote' | 'access'
  message: string
  timestamp: string
  metadata?: Record<string, string | number | boolean>
}

export function normalizeImei(raw: unknown): string {
  const imei = String(raw ?? '').trim()
  if (!IMEI_PATTERN.test(imei)) {
    throw new Error('IMEI must be 6-32 letters, digits, "-" or "_"')
  }
  return imei
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

function rowToDevice(row: any): any | null {
  try {
    const parsed = JSON.parse(row.data)
    const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString()
    const isOnline = (row.status === 'online' || row.status === 'warning') && row.lastSeen && row.lastSeen >= cutoff
    if (parsed.device) parsed.device.imei = row.deviceId
    return {
      ...parsed,
      deviceId: row.deviceId,
      deviceName: row.deviceName,
      status: isOnline ? row.status : 'offline',
      lastSeen: row.lastSeen || '',
    }
  } catch {
    return null
  }
}

export function isRegistered(deviceId: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM devices WHERE deviceId = ?').get(deviceId)
}

export function listDeviceIds(): string[] {
  return (getDb().prepare('SELECT deviceId FROM devices').all() as { deviceId: string }[]).map((r) => r.deviceId)
}

export function listDevices(): any[] {
  const rows = getDb().prepare('SELECT * FROM devices ORDER BY updatedAt DESC').all()
  return rows.map(rowToDevice).filter(Boolean)
}

export function getDevice(deviceId: string): any | null {
  const row = getDb().prepare('SELECT * FROM devices WHERE deviceId = ?').get(deviceId)
  return row ? rowToDevice(row) : null
}

function createInitialDevice(imei: string, name: string, model: string) {
  return {
    deviceId: imei,
    deviceName: name,
    status: 'offline',
    lastSeen: '',
    isSmartLock: true,
    device: {
      imei,
      modelId: model,
      serialNumber: '',
      appVersion: '',
      sdkVersion: '',
      hardwareVersion: '',
      bootReason: '',
      uptime: 0,
    },
    power: {
      batteryVoltage: 0,
      batteryPercentage: 0,
      isCharging: false,
      isUsbConnected: false,
      isExternalPower: false,
      isLowBattery: false,
      batteryMv: 0,
      extPowerVoltage: '',
      usb: 'N',
      charging: '',
      extPower: '',
      lowBattery: '',
    },
    cellular: {
      operator: '',
      networkType: '',
      rssi: 0,
      signalQuality: 0,
      ip: '',
      imsi: '',
      mcc: '',
      mnc: '',
      cellId: '',
      tac: '',
      band: '',
      rsrp: 0,
      rsrq: 0,
      sinr: 0,
      signal: 'OFFLINE',
      ip4: '',
      ip6: '',
    },
    gps: {
      isFixed: false,
      latitude: 0,
      longitude: 0,
      altitude: 0,
      speed: 0,
      heading: 0,
      satellites: 0,
      hdop: 0,
      accuracy: 0,
      lastFix: '',
      lastLocation: '',
      fixType: '',
      status: 'OFFLINE',
    },
    lock: {
      lockStatus: false,
      doorStatus: false,
      motorStatus: 'idle',
      motorCurrent: 0,
      positionSensor: false,
      lastLockTime: '',
      lastUnlockTime: '',
      unlockMethod: '',
      unlockCount: 0,
      failedUnlockCount: 0,
      lockMotorStatus: 'idle',
      motorCurrentMa: 0,
      lockPositionSensor: 'UNKNOWN',
      lastUnlockMethod: '',
      lockStatusStr: 'UNKNOWN',
      doorStatusStr: 'UNKNOWN',
    },
    access: {
      keypad: { status: 'OK', enabled: true, failedAttempts: 0, lastAccess: '', lastUsed: '', count: 0 },
      nfc: { enabled: true, lastUsed: '', count: 0 },
      bluetooth: { enabled: true, lastUsed: '', count: 0 },
      remote: { enabled: true, lastUsed: '', count: 0 },
      rtc: '',
    },
    tamper: {
      tamperStatus: false,
      caseOpen: false,
      wireCut: false,
      lockBreak: false,
      abnormalVibration: false,
      forcedUnlock: false,
      tamperCount: 0,
      lastTamperTime: '',
    },
    accelerometer: {
      motion: false,
      x: 0,
      y: 0,
      z: 0,
      status: 'OK',
      harshBraking: false,
      harshAcceleration: false,
      sharpTurn: false,
      harshBrakingCount: 0,
      harshAccelerationCount: 0,
      sharpTurnCount: 0,
      impactCount: 0,
      drivingScore: 100,
    },
    trip: { vehicleStatus: 'stationary', tripStatus: false, tripId: '', distance: 0, maximumSpeed: 0, overspeedCount: 0 },
    geofence: { status: 'inside', geofenceId: '', violation: false, lastEvent: '' },
    sensors: { temperature: 0, internalTemperature: 0, humidity: 0, hardwareSensorStatus: false },
    security: {
      deviceBinding: false,
      vehicleId: '',
      customerId: '',
      certificateStatus: false,
      secureBoot: false,
      firmwareSignature: false,
    },
    memory: { totalStorage: 0, usedStorage: 0, freeStorage: 0 },
    diagnostics: { lastDiagnosticTime: '', errorCodes: [], systemHealth: 'unknown' },
    rtc: { rtcTime: '', rtcSynced: false },
  }
}

/**
 * Register a lock. Idempotent: returns the existing row if already registered.
 */
export function registerDevice(reg: DeviceRegistration): { device: any; created: boolean } {
  const imei = normalizeImei(reg.imei)
  const existing = getDevice(imei)
  if (existing) return { device: existing, created: false }

  const customName = String(reg.deviceName ?? '').trim()
  const name = (customName && !customName.toLowerCase().startsWith('smartlock-') && customName !== imei) ? customName : imei
  const model = String(reg.modelId ?? '').trim() || 'GW1NS-4'
  const initial = createInitialDevice(imei, name, model)
  const now = new Date().toISOString()

  getDb()
    .prepare('INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
    .run(imei, name, 'offline', '', JSON.stringify(initial), now)

  return { device: initial, created: true }
}

export function deleteDevice(deviceId: string): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM alerts WHERE deviceId = ?').run(deviceId)
    db.prepare('DELETE FROM activity WHERE deviceId = ?').run(deviceId)
    db.prepare('DELETE FROM device_history WHERE deviceId = ?').run(deviceId)
    db.prepare('DELETE FROM devices WHERE deviceId = ?').run(deviceId)
  })()
}

export function clearAllDevices(): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM alerts').run()
    db.prepare('DELETE FROM activity').run()
    db.prepare('DELETE FROM device_history').run()
    db.prepare('DELETE FROM devices').run()
  })()
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export function getHistory(deviceId: string, from?: string, to?: string) {
  let sql = 'SELECT * FROM device_history WHERE deviceId = ?'
  const params: any[] = [deviceId]
  if (from) {
    sql += ' AND timestamp >= ?'
    params.push(from)
  }
  if (to) {
    sql += ' AND timestamp <= ?'
    params.push(to)
  }
  sql += ' ORDER BY timestamp ASC'

  return getDb()
    .prepare(sql)
    .all(...params)
    .map((row: any) => ({
      id: `hist-${row.id}`,
      deviceId: row.deviceId,
      latitude: row.latitude,
      longitude: row.longitude,
      altitude: row.altitude,
      speed: row.speed,
      heading: row.heading,
      accuracy: row.accuracy,
      batteryPercentage: row.batteryPercentage,
      batteryVoltage: row.batteryVoltage,
      lockStatus: row.lockStatus === 1,
      timestamp: row.timestamp,
      isFixed: true,
    }))
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export function listAlerts(): AlertRecord[] {
  return getDb()
    .prepare('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT ?')
    .all(LIST_LIMIT)
    .map((row: any) => ({
      id: row.id,
      deviceId: row.deviceId,
      type: row.type,
      message: row.message,
      severity: row.severity,
      timestamp: row.timestamp,
      acknowledged: row.acknowledged === 1,
    }))
}

export function acknowledgeAlert(id: string): boolean {
  return getDb().prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(id).changes > 0
}

export function acknowledgeAllAlerts(): number {
  return getDb().prepare('UPDATE alerts SET acknowledged = 1 WHERE acknowledged = 0').run().changes
}

type AlertRule = {
  type: string
  severity: AlertRecord['severity']
  active: (d: any) => boolean
  message: (id: string, d: any) => string
}

const ALERT_RULES: AlertRule[] = [
  {
    type: 'low_battery',
    severity: 'warning',
    active: (d) => typeof d?.power?.batteryPercentage === 'number' && d.power.batteryPercentage > 0 && d.power.batteryPercentage < 20,
    message: (id, d) => `Low battery: ${d.power.batteryPercentage}% on device ${id}`,
  },
  { type: 'tamper_detected', severity: 'critical', active: (d) => !!d?.tamper?.tamperStatus, message: (id) => `Tamper alert on device ${id}` },
  { type: 'forced_unlock', severity: 'critical', active: (d) => !!d?.tamper?.forcedUnlock, message: (id) => `Forced unlock detected on device ${id}` },
  { type: 'wire_cut', severity: 'critical', active: (d) => !!d?.tamper?.wireCut, message: (id) => `Wire cut detected on device ${id}` },
  { type: 'case_open', severity: 'critical', active: (d) => !!d?.tamper?.caseOpen, message: (id) => `Case opened on device ${id}` },
  { type: 'lock_break', severity: 'critical', active: (d) => !!d?.tamper?.lockBreak, message: (id) => `Lock break detected on device ${id}` },
  { type: 'abnormal_vibration', severity: 'warning', active: (d) => !!d?.tamper?.abnormalVibration, message: (id) => `Abnormal vibration on device ${id}` },
  { type: 'geofence_violation', severity: 'warning', active: (d) => !!d?.geofence?.violation, message: (id) => `Geofence violation on device ${id}` },
  {
    type: 'overspeed',
    severity: 'warning',
    active: (d) => Number(d?.trip?.overspeedCount) > 0,
    message: (id) => `Overspeed event on device ${id}`,
  },
]

/**
 * Raise an alert only on the transition into an alarm condition, so a lock
 * reporting every second doesn't flood the table with duplicates.
 */
export function recordAlertTransitions(deviceId: string, prev: any, next: any, now: string): AlertRecord[] {
  const raised: AlertRecord[] = []
  const insert = getDb().prepare(
    'INSERT INTO alerts (id, deviceId, type, message, severity, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
  )
  for (const rule of ALERT_RULES) {
    if (rule.active(next) && !rule.active(prev)) {
      const alert: AlertRecord = {
        id: uuidv4(),
        deviceId,
        type: rule.type,
        message: rule.message(deviceId, next),
        severity: next?.power?.batteryPercentage < 10 && rule.type === 'low_battery' ? 'critical' : rule.severity,
        timestamp: now,
        acknowledged: false,
      }
      insert.run(alert.id, alert.deviceId, alert.type, alert.message, alert.severity, alert.timestamp)
      raised.push(alert)
    }
  }
  return raised
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export function listActivity(): ActivityRecord[] {
  return getDb()
    .prepare('SELECT * FROM activity ORDER BY timestamp DESC LIMIT ?')
    .all(LIST_LIMIT)
    .map((row: any) => ({
      id: row.id,
      deviceId: row.deviceId,
      type: row.type,
      message: row.message,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }))
}

export function recordActivity(
  deviceId: string,
  type: ActivityRecord['type'],
  message: string,
  now: string,
  metadata?: ActivityRecord['metadata']
): ActivityRecord {
  const event: ActivityRecord = { id: uuidv4(), deviceId, type, message, timestamp: now, metadata }
  getDb()
    .prepare('INSERT INTO activity (id, deviceId, type, message, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)')
    .run(event.id, deviceId, type, message, now, metadata ? JSON.stringify(metadata) : null)
  return event
}

/**
 * Derive lock / door / tamper activity from consecutive MQTT state snapshots.
 * `prev` is null for the first message after registration, which only
 * establishes a baseline and never produces events.
 */
export function recordActivityTransitions(deviceId: string, prev: any, next: any, now: string): ActivityRecord[] {
  if (!prev || !prev.lastSeen) return []
  const events: ActivityRecord[] = []
  const name = next?.deviceName || deviceId

  const wasLocked = !!prev.lock?.lockStatus
  const isLocked = !!next.lock?.lockStatus
  if (wasLocked !== isLocked) {
    const method = next.lock?.unlockMethod || next.lock?.lastUnlockMethod || ''
    events.push(
      recordActivity(
        deviceId,
        isLocked ? 'lock' : 'unlock',
        isLocked ? `${name} locked` : `${name} unlocked${method ? ` via ${method}` : ''}`,
        now,
        method && !isLocked ? { method } : undefined
      )
    )
  }

  const wasOpen = !!prev.lock?.doorStatus
  const isOpen = !!next.lock?.doorStatus
  if (wasOpen !== isOpen) {
    events.push(recordActivity(deviceId, 'access', `${name} door ${isOpen ? 'opened' : 'closed'}`, now))
  }

  if (!prev.tamper?.tamperStatus && next.tamper?.tamperStatus) {
    events.push(recordActivity(deviceId, 'tamper', `Tamper detected on ${name}`, now))
  }

  return events
}

export function getSnapshot() {
  return { devices: listDevices(), alerts: listAlerts(), activity: listActivity() }
}
