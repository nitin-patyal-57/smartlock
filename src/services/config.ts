/**
 * The dashboard has a single data source: the SmartLock server's WebSocket,
 * which bridges the AWS IoT MQTT topics (soundbox_dev/{imei}/metrics|ack).
 */
export const config = {
  get wsUrl(): string {
    if (typeof window !== 'undefined') {
      const h = window.location.hostname
      if (h === 'localhost' || h === '127.0.0.1') {
        return 'ws://localhost:3001/ws'
      }
    }
    const fromEnv = import.meta.env.VITE_WS_URL
    if (fromEnv) return fromEnv
    if (typeof window !== 'undefined') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${proto}//${window.location.host}/ws`
    }
    return 'ws://localhost:3001/ws'
  },
}
