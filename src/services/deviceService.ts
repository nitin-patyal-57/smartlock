import type { SmartLockDevice, LocationHistoryEntry } from '@/types/smartlock'
import { wsService } from './websocket'
import { addRegisteredLock, clearRegisteredLocks, removeRegisteredLock } from './deviceRegistry'

/**
 * Dashboard data access. Everything goes over the SmartLock server WebSocket,
 * which is fed exclusively by MQTT (soundbox_dev/{imei}/metrics|ack).
 */

const IMEI_PATTERN = /^[A-Za-z0-9_-]{10,32}$/

type CommandResult = { success: boolean; error?: string }

async function command(type: string, payload: Record<string, unknown>): Promise<CommandResult> {
  try {
    await wsService.request(type, payload)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Command failed' }
  }
}

export const deviceService = {
  async addDevice(params: { imei: string; deviceName?: string; modelId?: string }): Promise<SmartLockDevice> {
    const imei = params.imei.trim()
    if (!IMEI_PATTERN.test(imei)) {
      throw new Error('Valid IMEI of at least 10 digits required')
    }
    const device = await wsService.request<SmartLockDevice>('add_device', {
      imei,
      deviceName: params.deviceName?.trim() || undefined,
      modelId: params.modelId?.trim() || undefined,
    })
    addRegisteredLock({ imei: device.deviceId, deviceName: device.deviceName, modelId: device.device?.modelId })
    wsService.upsertDevice(device)
    return device
  },

  /** Removes the lock everywhere: server DB, MQTT subscription and this browser's registry. */
  async deleteDevice(deviceId: string): Promise<void> {
    await wsService.request('delete_device', { deviceId })
    removeRegisteredLock(deviceId)
  },

  async clearAllDevices(): Promise<void> {
    await wsService.request('clear_devices')
    clearRegisteredLocks()
  },

  async getLocationHistory(deviceId: string, from?: string, to?: string): Promise<LocationHistoryEntry[]> {
    return wsService.request<LocationHistoryEntry[]>('get_history', { deviceId, from, to })
  },

  async acknowledgeAlert(id: string): Promise<void> {
    await wsService.request('ack_alert', { id })
  },

  async acknowledgeAllAlerts(): Promise<void> {
    await wsService.request('ack_all_alerts')
  },

  sendRelayCommand(deviceId: string, relay: 1 | 2, state: 'on' | 'off'): Promise<CommandResult> {
    return command('relay', { deviceId, relay, state })
  },

  sendLedCommand(
    deviceId: string,
    led: 'red' | 'green' | 'blue' | 'all',
    state: 'on' | 'off' | 'blink' | 'auto',
    duration_s?: number
  ): Promise<CommandResult> {
    return command('led', { deviceId, led, state, duration_s })
  },

  queryDeviceStatus(deviceId: string): Promise<CommandResult> {
    return command('status_query', { deviceId })
  },

  sendLockControl(
    deviceId: string,
    command: 'UNLOCK' | 'LOCK',
    pin: string
  ): Promise<CommandResult & { reason?: string; ack?: any }> {
    return wsService
      .request('lock_control', { deviceId, command, pin })
      .then((res: any) => ({ success: true, ...res }))
      .catch((err: any) => ({
        success: false,
        error: err instanceof Error ? err.message : String(err),
        reason: (err as any)?.reason,
      }))
  },
}
