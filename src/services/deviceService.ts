import { config } from './config'
import type { SmartLockDevice, Alert, LocationHistoryEntry, ActivityEvent } from '@/types/smartlock'
import { mockDevices, mockAlerts, mockLocationHistory, mockActivityEvents } from './mockData'
import { database, ref, onValue, get, query, orderByChild, startAt, endAt, isFirebaseConfigured } from './firebase'
import { fetchWalnutDevices, fetchWalnutDeviceByImei } from './walnutApi'

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

// Main service - combines Walnut Cloud API and local MQTT server
export const deviceService = {
  async getDevices(): Promise<SmartLockDevice[]> {
    if (config.USE_MOCK_DATA) return [...mockDevices]

    let localDevices: SmartLockDevice[] = []
    try {
      const res = await fetch('http://localhost:3001/api/devices', { signal: AbortSignal.timeout(1500) })
      if (res.ok) {
        localDevices = await res.json()
      }
    } catch {
      // Local server not running or unreachable
    }

    let walnutDevices: SmartLockDevice[] = []
    if (config.walnut.apiKey) {
      try {
        walnutDevices = await fetchWalnutDevices()
      } catch (e) {
        console.warn('Walnut API failed:', e)
      }
    }

    // Merge: if local device exists (e.g. updated by MQTT), merge its live telemetry
    const map = new Map<string, SmartLockDevice>()
    walnutDevices.forEach(d => map.set(d.deviceId, d))
    localDevices.forEach(ld => {
      const existing = map.get(ld.deviceId)
      if (existing) {
        map.set(ld.deviceId, { ...existing, ...ld, gps: { ...existing.gps, ...ld.gps } })
      } else {
        map.set(ld.deviceId, ld)
      }
    })

    return Array.from(map.values())
  },

  async getDeviceById(id: string): Promise<SmartLockDevice | undefined> {
    if (config.USE_MOCK_DATA) return mockDevices.find(d => d.deviceId === id)

    try {
      const res = await fetch(`http://localhost:3001/api/devices/${id}`, { signal: AbortSignal.timeout(1500) })
      if (res.ok) {
        return await res.json()
      }
    } catch {
      // Local server fallback
    }

    if (config.walnut.apiKey) {
      try {
        return await fetchWalnutDeviceByImei(id)
      } catch (e) {
        console.warn('Walnut API failed:', e)
      }
    }

    return undefined
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
      const url = new URL(`http://localhost:3001/api/devices/${deviceId}/history`)
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
}