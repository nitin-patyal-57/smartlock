import { config } from './config'
import type { SmartLockDevice, Alert, LocationHistoryEntry, ActivityEvent } from '@/types/smartlock'
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
  '861185084122693', // GPS Tracker confirmed by user (first card)
  '861185084122719', // GPS Tracker confirmed by user (third card)
  '861185084200101',
  '867787064208584',
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

/**
 * Check if a device payload represents a genuine SmartLock device.
 * Filters out plain GPS trackers, vehicle trackers, and soundboxes that only have GPS/cellular/relays without lock hardware.
 */
export function hasLockOption(json: any): boolean {
  if (!json || typeof json !== 'object') return false

  // Explicit type declaration
  if (
    json.isSmartLock === true ||
    json.deviceType === 'smartlock' ||
    json.device_type === 'smartlock' ||
    json.type === 'smartlock' ||
    json.device?.type === 'smartlock' ||
    json.device?.device_type === 'smartlock'
  ) {
    return true
  }

  // Explicit lock object: must exist and have content
  if (json.lock !== undefined && json.lock !== null) {
    if (typeof json.lock === 'object') {
      const keys = Object.keys(json.lock)
      if (keys.length > 0) return true
    } else {
      return true
    }
  }

  // Explicit lock/door status properties in payload
  if (
    json.lock_status !== undefined ||
    json.lockStatus !== undefined ||
    json.lock_state !== undefined ||
    json.lockState !== undefined ||
    json.door_status !== undefined ||
    json.doorStatus !== undefined ||
    json.door !== undefined ||
    json.smartlock !== undefined ||
    json.smart_lock !== undefined
  ) {
    return true
  }

  // Explicit lock relay (plain relays like relay '1' on vehicle GPS trackers are NOT smartlocks)
  if (json.relays && (json.relays.lock !== undefined || json.relays.smartlock !== undefined)) {
    return true
  }

  return false
}

export function isIgnoredDevice(id: string): boolean {
  if (!id) return true
  const clean = id.trim()
  if (
    clean === '861185084122693' || // First card: GPS Tracker confirmed by user
    clean === '861185084122719' || // Third card: GPS Tracker confirmed by user
    clean === '861185084200101' || // GPS Tracker
    clean === '867787064208584' || // Old dummy GPS tracker from user screenshot
    clean.startsWith('SL-') ||
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
  } catch { }
}

// Auto-purge stale demo entries and removed devices on load
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(STORAGE_CUSTOM_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        const cleaned = arr
          .filter((d) => d && d.deviceId && !isIgnoredDevice(d.deviceId) && d.deviceId !== '867509082945058')
        localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(cleaned))
      }
    }
    // Guarantee 867509082945058 is marked as deleted so it never resurrects
    const deletedRaw = localStorage.getItem(STORAGE_DELETED_KEY)
    const delArr = deletedRaw ? JSON.parse(deletedRaw) : []
    const delSet = new Set<string>(Array.isArray(delArr) ? delArr : [])
    delSet.add('867509082945058')
    localStorage.setItem(STORAGE_DELETED_KEY, JSON.stringify(Array.from(delSet)))
  } catch { }
}

export function getDeletedDeviceIds(): Set<string> {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_DELETED_KEY) : null
    if (raw) {
      const arr = JSON.parse(raw)
      const set = new Set<string>([...arr])
      set.delete('861185084122685')
      return set
    }
  } catch { }
  return new Set(['867509082945058'])
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
  } catch { }
}

export function getCustomDevicesFromStorage(): SmartLockDevice[] {
  try {
    if (typeof window === 'undefined') return []
    const raw = localStorage.getItem(STORAGE_CUSTOM_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const deleted = getDeletedDeviceIds()
        return parsed
          .filter((d) => d && d.deviceId && !isIgnoredDevice(d.deviceId) && !deleted.has(d.deviceId) && d.deviceId !== '867509082945058')
      }
    }
  } catch { }
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
  } catch { }
}

function createDefaultDevice(cleanImei: string, name?: string, model?: string): SmartLockDevice {
  const label = name?.trim() || `SmartLock-${cleanImei.slice(-4)}`
  const modelId = model?.trim() || 'GW1NS-4'

  return {
    deviceId: cleanImei,
    deviceName: label,
    status: 'offline',
    lastSeen: '',
    device: {
      imei: cleanImei,
      modelId,
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
      keypad: {
        status: 'OK',
        enabled: true,
        failedAttempts: 0,
        lastAccess: '',
        lastUsed: '',
        count: 0,
      },
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
    trip: {
      vehicleStatus: 'stationary',
      tripStatus: false,
      tripId: '',
      distance: 0,
      maximumSpeed: 0,
      overspeedCount: 0,
    },
    geofence: {
      status: 'inside',
      geofenceId: '',
      violation: false,
      lastEvent: '',
    },
    sensors: {
      temperature: 0,
      internalTemperature: 0,
      humidity: 0,
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
      totalStorage: 0,
      usedStorage: 0,
      freeStorage: 0,
    },
    diagnostics: {
      lastDiagnosticTime: '',
      errorCodes: [],
      systemHealth: 'unknown',
    },
    rtc: {
      rtcTime: '',
      rtcSynced: false,
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
    } catch { }
    return true
  },

  async getDevices(): Promise<SmartLockDevice[]> {
    const deleted = getDeletedDeviceIds()
    const customDevices = getCustomDevicesFromStorage()
    let serverDevices: SmartLockDevice[] = []

    const serverCandidates = [config.serverUrl]
    if (config.serverUrl !== 'http://localhost:3001') {
      serverCandidates.push('http://localhost:3001')
    }

    for (const url of serverCandidates) {
      try {
        const res = await fetch(`${url}/api/devices?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store' },
          signal: AbortSignal.timeout(3000),
        })
        if (res.ok) {
          const devices = await res.json()
          if (Array.isArray(devices) && devices.length > 0) {
            serverDevices = devices.filter(
              (d: any) => d && d.deviceId && !isIgnoredDevice(d.deviceId) && (hasLockOption(d) || d.deviceId === '861185084122685')
            )
            break
          }
        }
      } catch (e) {
        // Try next candidate
      }
    }

    const deviceMap = new Map<string, SmartLockDevice>()

    for (const d of serverDevices) {
      if (!isIgnoredDevice(d.deviceId) && !deleted.has(d.deviceId) && d.deviceId !== '867509082945058') {
        deviceMap.set(d.deviceId, d)
      }
    }

    for (const d of customDevices) {
      if (!isIgnoredDevice(d.deviceId) && !deleted.has(d.deviceId) && d.deviceId !== '867509082945058' && !deviceMap.has(d.deviceId)) {
        deviceMap.set(d.deviceId, d)
      }
    }

    const list = Array.from(deviceMap.values())
      .filter((d) => !isIgnoredDevice(d.deviceId) && !deleted.has(d.deviceId) && d.deviceId !== '867509082945058')

    return list.sort((a, b) => new Date(b.lastSeen || 0).getTime() - new Date(a.lastSeen || 0).getTime())
  },

  async getDeviceById(id: string): Promise<SmartLockDevice | undefined> {
    if (!id || getDeletedDeviceIds().has(id)) return undefined
    if (isIgnoredDevice(id)) return undefined

    let devFromServer: SmartLockDevice | undefined
    const serverCandidates = [config.serverUrl]
    if (config.serverUrl !== 'http://localhost:3001') {
      serverCandidates.push('http://localhost:3001')
    }

    for (const url of serverCandidates) {
      try {
        const res = await fetch(`${url}/api/devices/${id}?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store' },
          signal: AbortSignal.timeout(3000),
        })
        if (res.ok) {
          const dev = await res.json()
          if (dev && dev.deviceId && !isIgnoredDevice(dev.deviceId) && (hasLockOption(dev) || dev.deviceId === '861185084122685')) {
            devFromServer = dev
            break
          }
        }
      } catch {
        // Try next candidate
      }
    }

    if (devFromServer) {
      return devFromServer
    }

    const custom = getCustomDevicesFromStorage().find((d) => d.deviceId === id)
    if (custom) {
      return custom
    }

    return undefined
  },

  async addDevice(params: { imei: string; deviceName?: string; modelId?: string }): Promise<SmartLockDevice> {
    const cleanImei = params.imei.trim()
    if (!cleanImei || cleanImei.length < 10) {
      throw new Error('Valid IMEI of at least 10 digits required')
    }

    // Ensure device is un-deleted
    const deleted = getDeletedDeviceIds()
    if (deleted.has(cleanImei)) {
      deleted.delete(cleanImei)
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_DELETED_KEY, JSON.stringify(Array.from(deleted)))
      }
    }

    const name = params.deviceName?.trim() || `SmartLock-${cleanImei.slice(-4)}`
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