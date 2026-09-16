import { useState, useEffect, useCallback } from 'react'
import { wsService } from '@/services/websocket'
import { deviceService } from '@/services/deviceService'
import type { SmartLockDevice } from '@/types/smartlock'

export function useRealtimeDevices() {
  const [devices, setDevices] = useState<SmartLockDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

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
    wsService.connect()

    const handleDeviceUpdate = (data: { deviceId: string; data: any; timestamp?: string }) => {
      setDevices(prev => prev.map(d =>
        d.deviceId === data.deviceId
          ? { ...d, ...data.data, lastSeen: data.timestamp || new Date().toISOString(), status: 'online' as const }
          : d
      ))
    }

    wsService.on('device_update', handleDeviceUpdate)

    const checkConnection = () => {
      setConnected(true) // simplified - in real app check ws readyState
    }
    checkConnection()

    return () => {
      wsService.off('device_update', handleDeviceUpdate)
    }
  }, [fetchDevices])

  return { devices, loading, error, connected, refetch: fetchDevices }
}
