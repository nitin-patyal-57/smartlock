import { database, ref, onValue, isFirebaseConfigured } from './firebase'

type WSEventHandler = (data: any) => void

class RealtimeService {
  private unsubscribers: (() => void)[] = []
  private handlers: Map<string, WSEventHandler[]> = new Map()
  private localWs: WebSocket | null = null
  private reconnectTimer: any = null
  private deviceCallbacks: Set<(deviceId: string, data: any) => void> = new Set()
  private alertCallbacks: Set<(alert: any) => void> = new Set()

  constructor() {
    this.connectLocalWs()
  }

  private connectLocalWs() {
    if (typeof window === 'undefined') return

    try {
      const wsUrl = 'ws://localhost:3001/ws'
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        console.log('[WebSocket] Connected to local SmartLock server')
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = null
        }
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.event === 'device_update' && msg.data) {
            const { deviceId, data } = msg.data
            this.deviceCallbacks.forEach(cb => cb(deviceId, data))
          } else if (msg.event === 'alert' && msg.data) {
            this.alertCallbacks.forEach(cb => cb(msg.data))
          }

          // Trigger generic event handlers
          const eventHandlers = this.handlers.get(msg.event) || []
          eventHandlers.forEach(h => h(msg.data))
        } catch {
          // Ignore parse errors
        }
      }

      ws.onclose = () => {
        this.localWs = null
        // Reconnect after 3 seconds
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connectLocalWs()
          }, 3000)
        }
      }

      ws.onerror = () => {
        ws.close()
      }

      this.localWs = ws
    } catch {
      // Local server not running, continue silently
    }
  }

  subscribeToDeviceUpdates(callback: (deviceId: string, data: any) => void) {
    this.deviceCallbacks.add(callback)

    let fbUnsub = () => {}
    if (isFirebaseConfigured()) {
      try {
        const devicesRef = ref(database!, 'smartlock/devices')
        fbUnsub = onValue(devicesRef, (snapshot) => {
          snapshot.forEach((child) => {
            const val = child.val()
            callback(val.deviceId, {
              ...val.data,
              status: val.status,
              lastSeen: val.lastSeen
            })
          })
        })
      } catch (err) {
        console.warn('Firebase device update subscription error:', err)
      }
    }

    const unsubscribe = () => {
      this.deviceCallbacks.delete(callback)
      fbUnsub()
    }

    this.unsubscribers.push(unsubscribe)
    return unsubscribe
  }

  subscribeToAlerts(callback: (alert: any) => void) {
    this.alertCallbacks.add(callback)

    let fbUnsub = () => {}
    if (isFirebaseConfigured()) {
      try {
        const alertsRef = ref(database!, 'smartlock/alerts')
        fbUnsub = onValue(alertsRef, (snapshot) => {
          snapshot.forEach((child) => {
            callback(child.val())
          })
        })
      } catch (err) {
        console.warn('Firebase alert subscription error:', err)
      }
    }

    const unsubscribe = () => {
      this.alertCallbacks.delete(callback)
      fbUnsub()
    }

    this.unsubscribers.push(unsubscribe)
    return unsubscribe
  }

  subscribeToActivity(callback: (event: any) => void) {
    if (!isFirebaseConfigured()) return () => {}

    const activityRef = ref(database!, 'smartlock/activity')
    const unsubscribe = onValue(activityRef, (snapshot) => {
      snapshot.forEach((child) => {
        callback(child.val())
      })
    })

    this.unsubscribers.push(unsubscribe)
    return unsubscribe
  }

  on(event: string, handler: WSEventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, [])
    }
    this.handlers.get(event)!.push(handler)
  }

  off(event: string, handler: WSEventHandler) {
    const handlers = this.handlers.get(event) || []
    this.handlers.set(event, handlers.filter(h => h !== handler))
  }

  disconnect() {
    this.unsubscribers.forEach(unsub => unsub())
    this.unsubscribers = []
    this.deviceCallbacks.clear()
    this.alertCallbacks.clear()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.localWs) {
      this.localWs.close()
      this.localWs = null
    }
  }
}

export const wsService = new RealtimeService()
