import { WebSocket } from 'ws'

let clients: Set<WebSocket> = new Set()

export function addClient(ws: WebSocket) {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
}

export function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() })
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}
