import { config } from './config'
import type { SmartLockDevice, Alert, LocationHistoryEntry, ActivityEvent } from '@/types/smartlock'
import { mockDevices, mockAlerts, mockLocationHistory, mockActivityEvents } from './mockData'
import { database, ref, onValue, get, query, orderByChild, startAt, endAt, isFirebaseConfigured } from './firebase'

// Firebase-based implementation
async function fetchDevicesFromFirebase(): Promise<SmartLockDevice[]> {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured')
  const db = database!
  const snapshot = await get(ref(db, 'smartlock/devices'))
  if (!snapshot.exists()) return []

  const devices: SmartLockDevice[] = []
  snapshot.forEach((child) => {
    const val = child.val()
    devices.push({
      ...val.data,
      status: val.status,
      lastSeen: val.lastSeen,
      deviceId: val.deviceId,
      deviceName: val.deviceName
    })
  })
  return devices
}

async function fetchDeviceFromFirebase(id: string): Promise<SmartLockDevice | undefined> {
  if (!isFirebaseConfigured()) throw new Error('Firebase not configured')
  const db = database!
  const snapshot = await get(ref(db, `smartlock/devices/${id}`))
  if (!snapshot.exists()) return undefined
  const val = snapshot.val()
  return {
    ...val.data,
    status: val.status,
    lastSeen: val.lastSeen,
    deviceId: val.deviceId,
    deviceName: val.deviceName
  }
}

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

// Main service with Firebase-first, mock fallback
export const deviceService = {
  async getDevices(): Promise<SmartLockDevice[]> {
    try {
      if (config.USE_MOCK_DATA) throw new Error('Using mock data')
      return await fetchDevicesFromFirebase()
    } catch (e) {
      console.warn('Falling back to mock data:', e)
      return [...mockDevices]
    }
  },

  async getDeviceById(id: string): Promise<SmartLockDevice | undefined> {
    try {
      if (config.USE_MOCK_DATA) throw new Error('Using mock data')
      return await fetchDeviceFromFirebase(id)
    } catch (e) {
      console.warn('Falling back to mock data:', e)
      return mockDevices.find(d => d.deviceId === id)
    }
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
    // Fallback: mutate mock data
    const alert = mockAlerts.find(a => a.id === alertId)
    if (alert) alert.acknowledged = true
  },

  async getLocationHistory(deviceId: string, from?: string, to?: string): Promise<LocationHistoryEntry[]> {
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
}
