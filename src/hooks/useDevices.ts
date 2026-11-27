import { useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from 'react'
import type { SmartLockDevice, LocationHistoryEntry } from '@/types/smartlock'
import { deviceService } from '@/services/deviceService'
import { wsService, type RealtimeState } from '@/services/websocket'
import { useRefresh } from '@/context/RefreshContext'

/**
 * All hooks read from the single realtime store fed by the server WebSocket
 * (MQTT bridge). No REST calls, no polling for devices/alerts/activity.
 */
function useRealtimeState(): RealtimeState {
  return useSyncExternalStore(wsService.subscribe, wsService.getState)
}

function connectionStatus(s: RealtimeState) {
  return {
    loading: !s.synced && !s.connectionError,
    error: s.synced ? null : s.connectionError,
  }
}

const refresh = () => wsService.refresh()

export function useDevices() {
  const s = useRealtimeState()

  const addDevice = useCallback(
    (params: { imei: string; deviceName?: string; modelId?: string }) => deviceService.addDevice(params),
    [],
  )
  const deleteDevice = useCallback((deviceId: string) => deviceService.deleteDevice(deviceId), [])

  return { devices: s.devices, ...connectionStatus(s), refetch: refresh, addDevice, deleteDevice }
}

export function useDevice(id: string) {
  const s = useRealtimeState()
  const device = useMemo(() => s.devices.find((d) => d.deviceId === id), [s.devices, id])
  return { device, ...connectionStatus(s), refetch: refresh }
}

export function useAlerts() {
  const s = useRealtimeState()
  const acknowledgeAlert = useCallback((alertId: string) => deviceService.acknowledgeAlert(alertId), [])
  const acknowledgeAllAlerts = useCallback(() => deviceService.acknowledgeAllAlerts(), [])
  return { alerts: s.alerts, ...connectionStatus(s), refetch: refresh, acknowledgeAlert, acknowledgeAllAlerts }
}

export function useActivityEvents(deviceId?: string) {
  const s = useRealtimeState()
  const events = useMemo(
    () => (deviceId ? s.activity.filter((e) => e.deviceId === deviceId) : s.activity),
    [s.activity, deviceId],
  )
  return { events, ...connectionStatus(s), refetch: refresh }
}

/**
 * Location history is the one query that isn't pushed: it is requested over
 * the WebSocket and re-requested on the user's refresh interval.
 */
export function useLocationHistory(deviceId: string, from?: string, to?: string) {
  const [history, setHistory] = useState<LocationHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { refreshInterval, isAutoRefreshEnabled } = useRefresh()
  const connected = useSyncExternalStore(wsService.subscribe, () => wsService.getState().connected)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchHistory = useCallback(async () => {
    if (!deviceId) {
      setLoading(false)
      return
    }
    try {
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
    if (connected) fetchHistory()
  }, [fetchHistory, connected])

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (connected && isAutoRefreshEnabled && refreshInterval > 0 && deviceId) {
      intervalRef.current = setInterval(fetchHistory, refreshInterval * 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [connected, isAutoRefreshEnabled, refreshInterval, fetchHistory, deviceId])

  return { history, loading, error, refetch: fetchHistory }
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