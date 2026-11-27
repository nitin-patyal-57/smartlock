import type { ActivityEvent, Alert, SmartLockDevice } from '@/types/smartlock'
import { config } from './config'
import { getRegisteredLocks, removeRegisteredLock, clearRegisteredLocks, addRegisteredLock } from './deviceRegistry'

/**
 * Single realtime connection to the SmartLock server (MQTT bridge).
 * All dashboard data arrives here as server push events; mutations and
 * queries go out as request messages on the same socket.
 */

export interface RealtimeState {
  connected: boolean
  /** True once the server has answered a sync_devices request on the current or a previous connection. */
  synced: boolean
  connectionError: string | null
  devices: SmartLockDevice[]
  alerts: Alert[]
  activity: ActivityEvent[]
}

interface Snapshot {
  devices: SmartLockDevice[]
  alerts: Alert[]
  activity: ActivityEvent[]
}

interface PendingRequest {
  resolve: (value: any) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const RECONNECT_DELAY_MS = 3000
const REQUEST_TIMEOUT_MS = 10000
const MAX_EVENTS = 200

function mergeDevice(prev: SmartLockDevice | undefined, next: SmartLockDevice): SmartLockDevice {
  if (!prev) return next
  return {
    ...prev,
    ...next,
    gps: { ...prev.gps, ...next.gps },
    lock: { ...prev.lock, ...(next.lock || {}) },
  }
}

function toRegistryEntry(d: SmartLockDevice) {
  return { imei: d.deviceId, deviceName: d.deviceName, modelId: d.device?.modelId }
}

class RealtimeService {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reqSeq = 0
  private pending = new Map<string, PendingRequest>()
  private listeners = new Set<() => void>()
  private state: RealtimeState = {
    connected: false,
    synced: false,
    connectionError: null,
    devices: [],
    alerts: [],
    activity: [],
  }

  constructor() {
    if (typeof window !== 'undefined') this.connect()
  }

  // ---- store API (useSyncExternalStore) -----------------------------------

  getState = (): RealtimeState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private setState(patch: Partial<RealtimeState>) {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  // ---- connection ----------------------------------------------------------

  private connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    let ws: WebSocket
    try {
      ws = new WebSocket(config.wsUrl)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.setState({ connected: true, connectionError: null })
      void this.sync()
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        this.handleEvent(msg.event, msg.data)
      } catch {
        // ignore malformed frames
      }
    }

    ws.onclose = () => {
      if (this.ws === ws) this.ws = null
      this.failPending('Connection to the SmartLock server was lost')
      this.setState({ connected: false, connectionError: 'Cannot reach the SmartLock server. Retrying…' })
      this.scheduleReconnect()
    }

    ws.onerror = () => ws.close()
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, RECONNECT_DELAY_MS)
  }

  private failPending(reason: string) {
    this.pending.forEach((p) => {
      clearTimeout(p.timer)
      p.reject(new Error(reason))
    })
    this.pending.clear()
  }

  /** Re-register this browser's locks with the server and load a fresh snapshot. */
  private async sync() {
    try {
      const snapshot = await this.request<Snapshot>('sync_devices', { devices: getRegisteredLocks() })
      // Registry mirrors what the server tracks (drops IMEIs the server rejected).
      clearRegisteredLocks()
      snapshot.devices.slice().reverse().forEach((d) => addRegisteredLock(toRegistryEntry(d)))
      this.setState({
        synced: true,
        devices: snapshot.devices,
        alerts: snapshot.alerts,
        activity: snapshot.activity,
      })
    } catch {
      // onclose will retry
    }
  }

  /** Manual refresh: resync if connected, otherwise reconnect immediately. */
  refresh() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      void this.sync()
    } else if (!this.ws) {
      this.connect()
    }
  }

  request<T = unknown>(type: string, payload?: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const ws = this.ws
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected to the SmartLock server'))
        return
      }
      const reqId = `${Date.now()}-${++this.reqSeq}`
      const timer = setTimeout(() => {
        this.pending.delete(reqId)
        reject(new Error('SmartLock server did not respond in time'))
      }, REQUEST_TIMEOUT_MS)
      this.pending.set(reqId, { resolve, reject, timer })
      ws.send(JSON.stringify({ type, reqId, payload }))
    })
  }

  // ---- local updates (used after successful requests) ----------------------

  upsertDevice(device: SmartLockDevice) {
    const idx = this.state.devices.findIndex((d) => d.deviceId === device.deviceId)
    if (idx >= 0) {
      const devices = this.state.devices.slice()
      devices[idx] = mergeDevice(devices[idx], device)
      this.setState({ devices })
    } else {
      this.setState({ devices: [device, ...this.state.devices] })
    }
  }

  // ---- server events -------------------------------------------------------

  private handleEvent(event: string, data: any) {
    switch (event) {
      case 'response': {
        const p = this.pending.get(data?.reqId)
        if (!p) return
        this.pending.delete(data.reqId)
        clearTimeout(p.timer)
        if (data.ok) p.resolve(data.result)
        else p.reject(new Error(data.error || 'Request failed'))
        return
      }
      case 'device_update': {
        const device = data?.data as SmartLockDevice | undefined
        if (!data?.deviceId || !device) return
        const isNew = !this.state.devices.some((d) => d.deviceId === data.deviceId)
        this.upsertDevice({ ...device, deviceId: data.deviceId })
        if (isNew) addRegisteredLock(toRegistryEntry({ ...device, deviceId: data.deviceId }))
        return
      }
      case 'device_deleted': {
        const id = data?.deviceId
        if (!id) return
        removeRegisteredLock(id)
        this.setState({
          devices: this.state.devices.filter((d) => d.deviceId !== id),
          alerts: this.state.alerts.filter((a) => a.deviceId !== id),
          activity: this.state.activity.filter((e) => e.deviceId !== id),
        })
        return
      }
      case 'devices_cleared':
        clearRegisteredLocks()
        this.setState({ devices: [], alerts: [], activity: [] })
        return
      case 'alert':
        if (data?.id) this.setState({ alerts: [data as Alert, ...this.state.alerts].slice(0, MAX_EVENTS) })
        return
      case 'alerts_acknowledged': {
        const ids = new Set<string>(Array.isArray(data?.ids) ? data.ids : [])
        this.setState({
          alerts: this.state.alerts.map((a) => (data?.all || ids.has(a.id) ? { ...a, acknowledged: true } : a)),
        })
        return
      }
      case 'activity':
        if (data?.id) this.setState({ activity: [data as ActivityEvent, ...this.state.activity].slice(0, MAX_EVENTS) })
        return
    }
  }
}

export const wsService = new RealtimeService()
