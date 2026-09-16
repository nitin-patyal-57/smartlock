import { config } from './config'
import type { SmartLockDevice, Alert, LocationHistoryEntry, ActivityEvent } from '@/types/smartlock'
import { mockDevices, mockAlerts, mockLocationHistory, mockActivityEvents } from './mockData'

const API = config.API_BASE_URL
const HEADERS = {
  'Content-Type': 'application/json',
  'X-API-Key': config.API_KEY,
}

function fallback<T>(label: string, mock: T, error: unknown): T {
  console.warn(`${label} failed, using mock data:`, error)
  return mock
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  return res.json()
}

export const deviceService = {
  async getDevices(): Promise<SmartLockDevice[]> {
    if (config.USE_MOCK_DATA) return [...mockDevices]
    try {
      const data = await fetchJSON<SmartLockDevice[]>(`${API}/api/devices`, { headers: HEADERS })
      return data
    } catch (err) {
      return fallback('getDevices', [...mockDevices], err)
    }
  },

  async getDeviceById(id: string): Promise<SmartLockDevice | undefined> {
    if (config.USE_MOCK_DATA) return mockDevices.find((d) => d.deviceId === id)
    try {
      const data = await fetchJSON<SmartLockDevice>(`${API}/api/devices/${encodeURIComponent(id)}`, { headers: HEADERS })
      return data
    } catch (err) {
      return fallback('getDeviceById', mockDevices.find((d) => d.deviceId === id), err)
    }
  },

  async getAlerts(): Promise<Alert[]> {
    if (config.USE_MOCK_DATA) return [...mockAlerts]
    try {
      const data = await fetchJSON<Alert[]>(`${API}/api/alerts`, { headers: HEADERS })
      return data
    } catch (err) {
      return fallback('getAlerts', [...mockAlerts], err)
    }
  },

  async getAlertsByDeviceId(deviceId: string): Promise<Alert[]> {
    if (config.USE_MOCK_DATA) return mockAlerts.filter((a) => a.deviceId === deviceId)
    try {
      const data = await fetchJSON<Alert[]>(`${API}/api/alerts?deviceId=${encodeURIComponent(deviceId)}`, { headers: HEADERS })
      return data
    } catch (err) {
      return fallback('getAlertsByDeviceId', mockAlerts.filter((a) => a.deviceId === deviceId), err)
    }
  },

  async acknowledgeAlert(alertId: string): Promise<void> {
    if (config.USE_MOCK_DATA) {
      const alert = mockAlerts.find((a) => a.id === alertId)
      if (alert) alert.acknowledged = true
      return
    }
    try {
      await fetch(`${API}/api/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
        method: 'POST',
        headers: HEADERS,
      })
    } catch (err) {
      console.warn('acknowledgeAlert failed, using mock data:', err)
      const alert = mockAlerts.find((a) => a.id === alertId)
      if (alert) alert.acknowledged = true
    }
  },

  async getLocationHistory(
    deviceId: string,
    from?: string,
    to?: string,
  ): Promise<LocationHistoryEntry[]> {
    if (config.USE_MOCK_DATA) {
      let results = mockLocationHistory.filter((e) => e.deviceId === deviceId)
      if (from) results = results.filter((e) => e.timestamp >= from)
      if (to) results = results.filter((e) => e.timestamp <= to)
      return results
    }
    try {
      const params = new URLSearchParams({ deviceId })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const data = await fetchJSON<LocationHistoryEntry[]>(`${API}/api/location-history?${params}`, { headers: HEADERS })
      return data
    } catch (err) {
      let results = mockLocationHistory.filter((e) => e.deviceId === deviceId)
      if (from) results = results.filter((e) => e.timestamp >= from)
      if (to) results = results.filter((e) => e.timestamp <= to)
      return fallback('getLocationHistory', results, err)
    }
  },

  async getActivityEvents(): Promise<ActivityEvent[]> {
    if (config.USE_MOCK_DATA) return [...mockActivityEvents]
    try {
      const data = await fetchJSON<ActivityEvent[]>(`${API}/api/activity-events`, { headers: HEADERS })
      return data
    } catch (err) {
      return fallback('getActivityEvents', [...mockActivityEvents], err)
    }
  },

  async getActivityEventsByDevice(deviceId: string): Promise<ActivityEvent[]> {
    if (config.USE_MOCK_DATA) return mockActivityEvents.filter((e) => e.deviceId === deviceId)
    try {
      const data = await fetchJSON<ActivityEvent[]>(`${API}/api/activity-events?deviceId=${encodeURIComponent(deviceId)}`, { headers: HEADERS })
      return data
    } catch (err) {
      return fallback('getActivityEventsByDevice', mockActivityEvents.filter((e) => e.deviceId === deviceId), err)
    }
  },
}
