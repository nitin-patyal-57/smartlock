import { config } from './config'
import type { SmartLockDevice, Alert, LocationHistoryEntry, ActivityEvent } from '@/types/smartlock'
import { REAL_DEVICE_861185084122719 } from './realDevice'
import { mockDevices, mockAlerts, mockLocationHistory, mockActivityEvents } from './mockData'
import { database, ref, onValue, get, query, orderByChild, startAt, endAt, isFirebaseConfigured } from './firebase'

// Firebase-based implementation
async function fetchAlertsFromFirebase(): Promise<Alert[]> {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured')
  const db = database!
  const snapshot = await get(ref(db, 'smartlock/alerts'))
  if (!snapshot.exists()) return []

  const alerts: Alert[] = []
  snapshot.forEach((child) => {
    alerts.push(child.val())
  })
  return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

async function fetchLocationHistoryFromFirebase(deviceId: string, from?: string, to?: string): Promise<LocationHistoryEntry[]> {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured')
  const db = database!

  let q: any = query(ref(db, `smartlock/history/${deviceId}`), orderByChild('timestamp'))
  if (from) q = query(ref(db, `smartlock/history/${deviceId}`), orderByChild('timestamp'), startAt(from))
  if (to) q = query(ref(db, `smartlock/history/${deviceId}`), orderByChild('timestamp'), endAt(to))

  const snapshot = await get(q)
  if (!snapshot.exists()) return []

  const history: LocationHistoryEntry[] = []
  snapshot.forEach((child) => {
    const val = child.val()
    history.push({
      id: child.key || '',
      deviceId,
      latitude: val.latitude,
      longitude: val.longitude,
      altitude: val.altitude,
      speed: val.speed,
      heading: val.heading,
      accuracy: val.accuracy,
      timestamp: val.timestamp,
      isFixed: true
    })
  })
  return history
}

async function fetchActivityFromFirebase(deviceId?: string): Promise<ActivityEvent[]> {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured')
  const db = database!
  const snapshot = await get(ref(db, 'smartlock/activity'))
  if (!snapshot.exists()) return []

  let events: ActivityEvent[] = []
  snapshot.forEach((child) => {
    events.push(child.val())
  })

  if (deviceId) events = events.filter(e => e.deviceId === deviceId)
  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export const DEMO_DEVICE_IDS = new Set([
  '867509082945058',
  '861185084200101',
  '861185084188827',
  'SL-001',
  'SL-002',
  'SL-003',
  'SL-004',
  'SL-005',
  'SL-006',
  'SL-007',
  'SL-008',
  'SL-WSTEST',
])
const STORAGE_CUSTOM_KEY = 'custom_smartlock_devices'
const STORAGE_DELETED_KEY = 'deleted_smartlock_devices'

export function hasLockOption(json: any): boolean {
  if (!json || typeof json !== 'object') return false
  return (
    'lock' in json ||
    'lock_status' in json ||
    'lockStatus' in json ||
    'smartlock' in json ||
    'smart_lock' in json ||
    'lock_state' in json ||
    'lockState' in json ||
    'door_status' in json ||
    'doorStatus' in json ||
    Boolean(json.relays && (json.relays['1'] !== undefined || json.relays.lock !== undefined))
  )
}

export function isIgnoredDevice(id: string): boolean {
  if (!id) return true
  const clean = id.trim()
  if (
    clean.startsWith('86750908') ||
    clean.startsWith('SL-') ||
    clean === '861185084200101' ||
    clean === '861185084188827' ||
    DEMO_DEVICE_IDS.has(clean)
  ) {
    return true
  }
  return false
}

export function clearAllLocalData() {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_CUSTOM_KEY)
      localStorage.removeItem(STORAGE_DELETED_KEY)
    }
  } catch {}
}

// Auto-purge stale demo entries on load
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        const cleaned = arr.filter((d) => d && d.deviceId && !isIgnoredDevice(d.deviceId))
        localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(cleaned))
      }
    }
  } catch {}
}

export function getDeletedDeviceIds(): Set<string> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_DELETED_KEY) : null
    if (raw) {
      const arr = JSON.parse(raw)
      return new Set([...arr])
    }
  } catch {}
  return new Set()
}

export function markDeviceDeleted(deviceId: string) {
  try {
    const set = getDeletedDeviceIds()
    set.add(deviceId)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_DELETED_KEY, JSON.stringify(Array.from(set)))

      const custom = getCustomDevicesFromStorage()
      const filtered = custom.filter((d) => d.deviceId !== deviceId)
      localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(filtered))
    }
  } catch {}
}

export function getCustomDevicesFromStorage(): SmartLockDevice[] {
  try {
    if (typeof window === 'undefined') return []
    const raw = localStorage.getItem(STORAGE_CUSTOM_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const deleted = getDeletedDeviceIds()
        return parsed.filter((d) => d && d.deviceId && !isIgnoredDevice(d.deviceId) && !deleted.has(d.deviceId))
      }
    }
  } catch {}
  return []
}

export function saveCustomDeviceToStorage(device: SmartLockDevice) {
  try {
    if (typeof window === 'undefined' || isIgnoredDevice(device.deviceId)) return

    const current = getCustomDevicesFromStorage().filter((d) => d.deviceId !== device.deviceId)
    current.unshift(device)
    localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(current))

    const deleted = getDeletedDeviceIds()
    if (deleted.has(device.deviceId)) {
      deleted.delete(device.deviceId)
      localStorage.setItem(STORAGE_DELETED_KEY, JSON.stringify(Array.from(deleted)))
    }
  } catch {}
}

function createDefaultDevice(cleanImei: string, name?: string, model?: string): SmartLockDevice {
  const now = new Date().toISOString()
  const label = name?.trim() || `Smart Lock ${cleanImei.slice(-4)}`
  const modelId = model?.trim() || 'GW1NS-4'

  return {
    deviceId: cleanImei,
    deviceName: label,
    status: 'online',
    lastSeen: now,
    device: {
      imei: cleanImei,
      modelId,
      serialNumber: `SN-${cleanImei.slice(-6)}`,
      appVersion: 'WMZ_DEV_1.0.2',
      sdkVersion: 'WM_SDK_C_261008',
      hardwareVersion: 'Z636_V1',
      bootReason: 'manual registration',
      uptime: 0,
    },
    power: {
      batteryVoltage: 4.22,
      batteryPercentage: 100,
      isCharging: false,
      isUsbConnected: false,
      isExternalPower: false,
      isLowBattery: false,
      batteryMv: 4222,
      extPowerVoltage: '',
    },
    cellular: {
      operator: 'IND airtel',
      networkType: 'LTE',
      rssi: 28,
      signalQuality: 4,
      ip: '172.18.222.207',
      imsi: '',
      mcc: '404',
      mnc: '02',
      cellId: '',
      tac: '',
      band: '3',
      rsrp: 52,
      rsrq: 13,
      sinr: 0,
      signal: 'EXCELLENT',
      ip4: '172.18.222.207',
      ip6: '',
    },
    gps: {
      isFixed: true,
      latitude: 30.657035,
      longitude: 76.729596,
      altitude: 301.7,
      speed: 0,
      heading: 0,
      satellites: 24,
      hdop: 0.8,
      accuracy: 2.5,
      lastFix: now,
      lastLocation: 'Mohali / Zirakpur, PB',
      fixType: '3D',
      status: 'FIXED',
    },
    lock: {
      lockStatus: true,
      doorStatus: false,
      motorStatus: 'idle',
      motorCurrent: 0,
      positionSensor: true,
      lastLockTime: now,
      lastUnlockTime: '',
      unlockMethod: 'manual',
      unlockCount: 0,
      failedUnlockCount: 0,
    },
    access: {
      keypad: { enabled: true, lastUsed: '', count: 0 },
      nfc: { enabled: true, lastUsed: '', count: 0 },
      bluetooth: { enabled: true, lastUsed: '', count: 0 },
      remote: { enabled: true, lastUsed: '', count: 0 },
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
      z: -1,
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
    trip: {
      vehicleStatus: 'stationary',
      tripStatus: false,
      tripId: `TRIP-${cleanImei.slice(-4)}`,
      distance: 0,
      maximumSpeed: 0,
      overspeedCount: 0,
    },
    geofence: {
      status: 'inside',
      geofenceId: 'GF-01',
      violation: false,
      lastEvent: 'enter',
    },
    sensors: {
      temperature: 28.0,
      internalTemperature: 31.0,
      humidity: 50,
      hardwareSensorStatus: true,
    },
    security: {
      deviceBinding: true,
      vehicleId: '',
      customerId: '',
      certificateStatus: true,
      secureBoot: true,
      firmwareSignature: true,
    },
    memory: {
      totalStorage: 16777216,
      usedStorage: 5242880,
      freeStorage: 11534336,
    },
    diagnostics: {
      lastDiagnosticTime: now,
      errorCodes: [],
      systemHealth: 'good',
    },
    rtc: {
      rtcTime: now,
      rtcSynced: true,
    },
  }
}

// Main service - pure MQTT from SmartLock cloud server
export const deviceService = {
  isIgnoredDevice,
  getDeletedDeviceIds,
  markDeviceDeleted,
  hasLockOption,
  clearAllLocalData,

  async clearAllDevices(): Promise<boolean> {
    clearAllLocalData()
    try {
      await fetch(`${config.serverUrl}/api/devices`, {
        method: 'DELETE',
        headers: { 'Cache-Control': 'no-cache, no-store' },
        signal: AbortSignal.timeout(6000),
      })
    } catch {}
    return true
  },

  async getDevices(): Promise<SmartLockDevice[]> {
    const deleted = getDeletedDeviceIds()
    const customDevices = getCustomDevicesFromStorage()
    let serverDevices: SmartLockDevice[] = []

    try {
      const res = await fetch(`${config.serverUrl}/api/devices?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store' },
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) {
        const devices = await res.json()
        if (Array.isArray(devices)) {
          serverDevices = devices.filter(
            (d: any) => d && d.deviceId && !isIgnoredDevice(d.deviceId) && (hasLockOption(d) || d.lock !== undefined)
          )
        }
      }
    } catch (e) {
      console.warn('Failed to fetch devices from server:', e)
    }

    const deviceMap = new Map<string, SmartLockDevice>()

    for (const d of serverDevices) {
      if (!isIgnoredDevice(d.deviceId)) {
        deviceMap.set(d.deviceId, d)
      }
    }

    for (const d of customDevices) {
      if (!isIgnoredDevice(d.deviceId) && !deleted.has(d.deviceId) && !deviceMap.has(d.deviceId)) {
        deviceMap.set(d.deviceId, d)
      }
    }

    const list = Array.from(deviceMap.values())
    return list.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
  },

  async getDeviceById(id: string): Promise<SmartLockDevice | undefined> {
    if (!id || isIgnoredDevice(id) || getDeletedDeviceIds().has(id)) return undefined

    try {
      const res = await fetch(`${config.serverUrl}/api/devices/${id}?_t=${Date.now()}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) {
        const dev = await res.json()
        if (dev && dev.deviceId && !isIgnoredDevice(dev.deviceId)) return dev
      }
    } catch {
      // Server fallback
    }

    const custom = getCustomDevicesFromStorage().find((d) => d.deviceId === id)
    if (custom) return custom

    return undefined
  },

  async addDevice(params: { imei: string; deviceName?: string; modelId?: string }): Promise<SmartLockDevice> {
    const cleanImei = params.imei.trim()
    if (!cleanImei || cleanImei.length < 10) {
      throw new Error('Valid IMEI of at least 10 digits required')
    }
    if (isIgnoredDevice(cleanImei)) {
      throw new Error('This demo IMEI has been decommissioned.')
    }

    const name = params.deviceName?.trim() || `Smart Lock ${cleanImei.slice(-4)}`
    const model = params.modelId?.trim() || 'GW1NS-4'
    const newDevice = createDefaultDevice(cleanImei, name, model)

    try {
      const res = await fetch(`${config.serverUrl}/api/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store',
        },
        body: JSON.stringify({
          imei: cleanImei,
          deviceName: name,
          modelId: model,
        }),
        signal: AbortSignal.timeout(4000),
      })

      if (res.ok) {
        const body = await res.json()
        if (body.device) {
          saveCustomDeviceToStorage(body.device)
          return body.device
        }
      }
    } catch {
      // Server offline fallback
    }

    saveCustomDeviceToStorage(newDevice)
    return newDevice
  },

  async deleteDevice(deviceId: string): Promise<boolean> {
    markDeviceDeleted(deviceId)
    try {
      await fetch(`${config.serverUrl}/api/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { 'Cache-Control': 'no-cache, no-store' },
        signal: AbortSignal.timeout(3000),
      })
    } catch {
      // Local removal succeeded
    }
    return true
  },

  async getAlerts(): Promise<Alert[]> {
    try {
      if (config.USE_MOCK_DATA) throw new Error('Using mock data')
      return await fetchAlertsFromFirebase()
    } catch (e) {
      console.warn('Falling back to mock data:', e)
      return [...mockAlerts]
    }
  },

  async getAlertsByDeviceId(deviceId: string): Promise<Alert[]> {
    try {
      if (config.USE_MOCK_DATA) throw new Error('Using mock data')
      const alerts = await fetchAlertsFromFirebase()
      return alerts.filter(a => a.deviceId === deviceId)
    } catch (e) {
      return mockAlerts.filter(a => a.deviceId === deviceId)
    }
  },

  async acknowledgeAlert(alertId: string): Promise<void> {
    try {
      if (isFirebaseConfigured()) {
        const { set: fbSet, ref: fbRef } = await import('firebase/database')
        await fbSet(fbRef(database!, `smartlock/alerts/${alertId}/acknowledged`), true)
        return
      }
    } catch (e) {
      console.warn('Firebase acknowledge failed, using local:', e)
    }
    const alert = mockAlerts.find(a => a.id === alertId)
    if (alert) alert.acknowledged = true
  },

  async acknowledgeAllAlerts(): Promise<void> {
    try {
      if (isFirebaseConfigured()) {
        const { get: fbGet, ref: fbRef, update: fbUpdate } = await import('firebase/database')
        const snapshot = await fbGet(fbRef(database!, 'smartlock/alerts'))
        if (snapshot.exists()) {
          const updates: Record<string, boolean> = {}
          snapshot.forEach((child) => {
            const alert = child.val()
            if (!alert.acknowledged) {
              updates[`smartlock/alerts/${child.key}/acknowledged`] = true
            }
          })
          if (Object.keys(updates).length > 0) {
            await fbUpdate(fbRef(database!), updates)
          }
        }
        return
      }
    } catch (e) {
      console.warn('Firebase acknowledgeAll failed, using local:', e)
    }
    mockAlerts.forEach(a => { a.acknowledged = true })
  },

  async getLocationHistory(deviceId: string, from?: string, to?: string): Promise<LocationHistoryEntry[]> {
    try {
      const url = new URL(`${config.serverUrl}/api/devices/${deviceId}/history`)
      if (from) url.searchParams.set('from', from)
      if (to) url.searchParams.set('to', to)
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(1500) })
      if (res.ok) {
        const rows = await res.json()
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map((r: any) => ({
            id: String(r.id),
            deviceId: r.deviceId,
            latitude: r.latitude,
            longitude: r.longitude,
            altitude: r.altitude,
            speed: r.speed,
            heading: r.heading,
            accuracy: r.accuracy,
            timestamp: r.timestamp,
            isFixed: true,
          }))
        }
      }
    } catch {
      // Local server fallback
    }

    try {
      if (config.USE_MOCK_DATA) throw new Error('Using mock data')
      return await fetchLocationHistoryFromFirebase(deviceId, from, to)
    } catch (e) {
      console.warn('Falling back to mock data:', e)
      return mockLocationHistory.filter(h => h.deviceId === deviceId)
    }
  },

  async getActivityEvents(deviceId?: string): Promise<ActivityEvent[]> {
    try {
      if (config.USE_MOCK_DATA) throw new Error('Using mock data')
      return await fetchActivityFromFirebase(deviceId)
    } catch (e) {
      console.warn('Falling back to mock data:', e)
      return [...mockActivityEvents]
    }
  },

  async getActivityEventsByDevice(deviceId: string): Promise<ActivityEvent[]> {
    try {
      if (config.USE_MOCK_DATA) throw new Error('Using mock data')
      return await fetchActivityFromFirebase(deviceId)
    } catch (e) {
      return mockActivityEvents.filter(e => e.deviceId === deviceId)
    }
  },

  async sendRelayCommand(deviceId: string, relay: 1 | 2, state: 'on' | 'off'): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${config.serverUrl}/api/devices/${deviceId}/relay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relay, state })
      })
      const data = await res.json()
      return data
    } catch (err: any) {
      console.error('Failed to send relay command:', err)
      return { success: false, error: err.message || 'Network error' }
    }
  },

  async sendLedCommand(
    deviceId: string,
    led: 'red' | 'green' | 'blue' | 'all',
    state: 'on' | 'off' | 'blink' | 'auto',
    duration_s?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${config.serverUrl}/api/devices/${deviceId}/led`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ led, state, duration_s })
      })
      const data = await res.json()
      return data
    } catch (err: any) {
      console.error('Failed to send LED command:', err)
      return { success: false, error: err.message || 'Network error' }
    }
  },

  async queryDeviceStatus(deviceId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch(`${config.serverUrl}/api/devices/${deviceId}/status-cmd`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      return data
    } catch (err: any) {
      console.error('Failed to send status query command:', err)
      return { success: false, error: err.message || 'Network error' }
    }
  },
}