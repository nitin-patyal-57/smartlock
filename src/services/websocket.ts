import { config } from './config'

type WSEventHandler = (data: any) => void

class WebSocketService {
  private ws: WebSocket | null = null
  private handlers: Map<string, WSEventHandler[]> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    try {
      this.ws = new WebSocket(config.WS_URL)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.reconnectAttempts = 0
      }

      this.ws.onmessage = (event) => {
        try {
          const { event: eventType, data } = JSON.parse(event.data)
          const handlers = this.handlers.get(eventType) || []
          handlers.forEach(handler => handler(data))
        } catch (e) {
          console.warn('WebSocket message parse error:', e)
        }
      }

      this.ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...')
        this.scheduleReconnect()
      }

      this.ws.onerror = (error) => {
        console.warn('WebSocket error:', error)
      }
    } catch (e) {
      console.warn('WebSocket connection failed:', e)
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return
    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
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
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
  }
}

export const wsService = new WebSocketService()
