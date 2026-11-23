import { useState, useEffect, useCallback, useRef } from 'react'
import { deviceService } from '@/services/deviceService'
import { wsService } from '@/services/websocket'
import type { SmartLockDevice } from '@/types/smartlock'

export function useRealtimeDevices() {
  const [devices, setDevices] = useState<SmartLockDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const devicesRef = useRef<SmartLockDevice[]>([])

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await deviceService.getDevices()
      devicesRef.current = data
      setDevices(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch devices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDevices()

    const unsubscribe = wsService.subscribeToDeviceUpdates((deviceId, data) => {
      setDevices(prev => {
        const idx = prev.findIndex(d => d.deviceId === deviceId)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], ...data }
          return next
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