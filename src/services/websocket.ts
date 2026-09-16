import { database, ref, onValue, isFirebaseConfigured } from './firebase'

type WSEventHandler = (data: any) => void

class RealtimeService {
  private unsubscribers: (() => void)[] = []
  private handlers: Map<string, WSEventHandler[]> = new Map()

  subscribeToDeviceUpdates(callback: (deviceId: string, data: any) => void) {
    if (!isFirebaseConfigured()) return () => {}

    const devicesRef = ref(database!, 'smartlock/devices')
    const unsubscribe = onValue(devicesRef, (snapshot) => {
      snapshot.forEach((child) => {
        const val = child.val()
        callback(val.deviceId, {
          ...val.data,
          status: val.status,
          lastSeen: val.lastSeen
        })
      })
    })

    this.unsubscribers.push(unsubscribe)
    return unsubscribe
  }

  subscribeToAlerts(callback: (alert: any) => void) {
    if (!isFirebaseConfigured()) return () => {}

    const alertsRef = ref(database!, 'smartlock/alerts')
    const unsubscribe = onValue(alertsRef, (snapshot) => {
      snapshot.forEach((child) => {
        callback(child.val())
      })
    })

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
  }
}

export const wsService = new RealtimeService()
