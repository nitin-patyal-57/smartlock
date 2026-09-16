import { useState, useEffect, useCallback } from 'react'
import { deviceService } from '@/services/deviceService'
import { wsService } from '@/services/websocket'
import type { SmartLockDevice } from '@/types/smartlock'

export function useRealtimeDevices() {
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

    // Subscribe to real-time updates
    const unsubscribe = wsService.subscribeToDeviceUpdates((deviceId, data) => {
      setDevices(prev => {
        const existing = prev.find(d => d.deviceId === deviceId)
        if (existing) {
          return prev.map(d => d.deviceId === deviceId ? { ...d, ...data } : d)
        }
        return [...prev, data as SmartLockDevice]
      })
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [fetchDevices])

  return { devices, loading, error, connected: true, refetch: fetchDevices }
}
