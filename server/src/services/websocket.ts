import { WebSocket } from 'ws'
import * as store from './deviceStore'
import {
  publishLedCommand,
  publishRelayCommand,
  publishStatusCommand,
  subscribeToDeviceMqtt,
  unsubscribeFromDeviceMqtt,
} from './mqttService'

/**
 * WebSocket is the dashboard's only interface to the server.
 *
 * Server -> client: { event, data, timestamp }
 *   response, device_update, device_deleted, devices_cleared, alert,
 *   alerts_acknowledged, activity, device_ack
 * Client -> server: { type, reqId, payload }  (answered with event 'response')
 */

const clients: Set<WebSocket> = new Set()
const MAX_SYNC_DEVICES = 200

function send(ws: WebSocket, event: string, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }))
  }
}

export function broadcast(event: string, data: unknown) {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() })
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

function requireRegistered(deviceId: unknown): string {
  const id = store.normalizeImei(deviceId)
  if (!store.isRegistered(id)) throw new Error(`Device ${id} is not registered`)
  return id
}

function registerAndSubscribe(reg: store.DeviceRegistration) {
  const { device, created } = store.registerDevice(reg)
  subscribeToDeviceMqtt(device.deviceId)
  if (created) {
    broadcast('device_update', { deviceId: device.deviceId, data: device, timestamp: new Date().toISOString() })
  }
  return device
}

function recordRemote(deviceId: string, message: string, metadata?: store.ActivityRecord['metadata']) {
  const event = store.recordActivity(deviceId, 'remote', message, new Date().toISOString(), metadata)
  broadcast('activity', event)
}

type Handler = (payload: any) => unknown | Promise<unknown>

const handlers: Record<string, Handler> = {
  // Browser re-registers its locks after every (re)connect; the server's DB is ephemeral.
  sync_devices(payload) {
    const list: unknown[] = Array.isArray(payload?.devices) ? payload.devices.slice(0, MAX_SYNC_DEVICES) : []
    for (const reg of list) {
      try {
        registerAndSubscribe(reg as store.DeviceRegistration)
      } catch (e) {
        console.warn('[WS] Skipping invalid device in sync:', (e as Error).message)
      }
    }
    return store.getSnapshot()
  },

  add_device(payload) {
    return registerAndSubscribe(payload as store.DeviceRegistration)
  },

  delete_device(payload) {
    const deviceId = String(payload?.deviceId ?? '').trim()
    if (!deviceId) throw new Error('deviceId is required')
    store.deleteDevice(deviceId)
    unsubscribeFromDeviceMqtt(deviceId)
    broadcast('device_deleted', { deviceId })
    return { deviceId }
  },

  clear_devices() {
    const ids = store.listDeviceIds()
    store.clearAllDevices()
    ids.forEach(unsubscribeFromDeviceMqtt)
    broadcast('devices_cleared', { count: ids.length })
    return { count: ids.length }
  },

  async relay(payload) {
    const deviceId = requireRegistered(payload?.deviceId)
    const relay = Number(payload?.relay)
    const state = payload?.state
    if (relay !== 1 && relay !== 2) throw new Error('relay must be 1 or 2')
    if (state !== 'on' && state !== 'off') throw new Error('state must be "on" or "off"')
    if (!(await publishRelayCommand(deviceId, relay, state))) throw new Error('MQTT broker not connected')
    recordRemote(deviceId, `Relay ${relay} turned ${state}`, { relay, state })
    return { deviceId, relay, state }
  },

  async led(payload) {
    const deviceId = requireRegistered(payload?.deviceId)
    const { led, state } = payload ?? {}
    if (!['red', 'green', 'blue', 'all'].includes(led)) throw new Error('led must be red, green, blue or all')
    if (!['on', 'off', 'blink', 'auto'].includes(state)) throw new Error('state must be on, off, blink or auto')
    const duration = typeof payload?.duration_s === 'number' ? payload.duration_s : 0
    if (!(await publishLedCommand(deviceId, led, state, duration))) throw new Error('MQTT broker not connected')
    recordRemote(deviceId, `LED ${led} set to ${state}`, { led, state })
    return { deviceId, led, state, duration_s: duration }
  },

  async status_query(payload) {
    const deviceId = requireRegistered(payload?.deviceId)
    if (!(await publishStatusCommand(deviceId))) throw new Error('MQTT broker not connected')
    return { deviceId }
  },

  get_history(payload) {
    const deviceId = String(payload?.deviceId ?? '').trim()
    if (!deviceId) throw new Error('deviceId is required')
    const from = typeof payload?.from === 'string' ? payload.from : undefined
    const to = typeof payload?.to === 'string' ? payload.to : undefined
    return store.getHistory(deviceId, from, to)
  },

  ack_alert(payload) {
    const id = String(payload?.id ?? '')
    if (!store.acknowledgeAlert(id)) throw new Error('Alert not found')
    broadcast('alerts_acknowledged', { ids: [id] })
    return { id }
  },

  ack_all_alerts() {
    const count = store.acknowledgeAllAlerts()
    broadcast('alerts_acknowledged', { all: true })
    return { count }
  },
}

async function handleMessage(ws: WebSocket, raw: string) {
  let msg: any
  try {
    msg = JSON.parse(raw)
  } catch {
    return
  }
  const reqId = msg?.reqId
  const handler = typeof msg?.type === 'string' ? handlers[msg.type] : undefined
  if (!handler) {
    send(ws, 'response', { reqId, ok: false, error: `Unknown request type "${msg?.type}"` })
    return
  }
  try {
    const result = await handler(msg.payload)
    send(ws, 'response', { reqId, ok: true, result })
  } catch (e) {
    send(ws, 'response', { reqId, ok: false, error: (e as Error).message || 'Request failed' })
  }
}

export function addClient(ws: WebSocket) {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
  ws.on('message', (data) => {
    void handleMessage(ws, data.toString())
  })
  // No unsolicited snapshot: the client first sends sync_devices (its lock
  // registry) and receives the snapshot as the response.
}
