import { useState, useEffect, useCallback } from 'react'
import type { SmartLockDevice, Alert, LocationHistoryEntry, ActivityEvent } from '@/types/smartlock'
import { deviceService } from '@/services/deviceService'

export function useDevices() {
  const [devices, setDevices] = useState<SmartLockDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await deviceService.getDevices()
      setDevices(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch devices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDevices()
  }, [fetchDevices])

  return { devices, loading, error, refetch: fetchDevices }
}

export function useDevice(id: string) {
  const [device, setDevice] = useState<SmartLockDevice | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDevice = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await deviceService.getDeviceById(id)
      setDevice(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch device')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDevice()
  }, [fetchDevice])

  return { device, loading, error, refetch: fetchDevice }
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await deviceService.getAlerts()
      setAlerts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  const acknowledgeAlert = useCallback(
    async (alertId: string) => {
      await deviceService.acknowledgeAlert(alertId)
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)),
      )
    },
    [],
  )

  return { alerts, loading, error, refetch: fetchAlerts, acknowledgeAlert }
}

export function useLocationHistory(deviceId: string, from?: string, to?: string) {
  const [history, setHistory] = useState<LocationHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!deviceId) return
    try {
      setLoading(true)
      setError(null)
      const data = await deviceService.getLocationHistory(deviceId, from, to)
      setHistory(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch location history')
    } finally {
      setLoading(false)
    }
  }, [deviceId, from, to])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  return { history, loading, error, refetch: fetchHistory }
}

export function useActivityEvents(deviceId?: string) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = deviceId
        ? await deviceService.getActivityEventsByDevice(deviceId)
        : await deviceService.getActivityEvents()
      setEvents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch activity events')
    } finally {
      setLoading(false)
    }
  }, [deviceId])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  return { events, loading, error, refetch: fetchEvents }
}

interface DashboardStats {
  totalDevices: number
  onlineDevices: number
  offlineDevices: number
  activeAlerts: number
  averageBattery: number
  lowBatteryDevices: number
}

export function useDashboardStats(devices: SmartLockDevice[]): DashboardStats {
  const [stats, setStats] = useState<DashboardStats>({
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    activeAlerts: 0,
    averageBattery: 0,
    lowBatteryDevices: 0,
  })

  useEffect(() => {
    const totalDevices = devices.length
    const onlineDevices = devices.filter((d) => d.status === 'online').length
    const offlineDevices = devices.filter((d) => d.status === 'offline').length
    const averageBattery =
      devices.length > 0
        ? devices.reduce((sum, d) => sum + d.power.batteryPercentage, 0) / devices.length
        : 0
    const lowBatteryDevices = devices.filter((d) => d.power.isLowBattery).length

    setStats({
      totalDevices,
      onlineDevices,
      offlineDevices,
      activeAlerts: 0,
      averageBattery: Math.round(averageBattery * 10) / 10,
      lowBatteryDevices,
    })
  }, [devices])

  return stats
}