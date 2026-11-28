/**
 * The list of locks this browser has registered. The server runs on an
 * ephemeral disk (Render free tier), so after every (re)connect the dashboard
 * sends this list to the server, which re-subscribes to each lock's MQTT topics.
 *
 * Only identity is stored here - never telemetry.
 */

export interface RegisteredLock {
  imei: string
  deviceName?: string
  modelId?: string
}

const REGISTRY_KEY = 'smartlock_registry_v1'
const PURGE_KEY = 'smartlock_clean_state_v8'
const LEGACY_KEYS = [
  'custom_smartlock_devices',
  'deleted_smartlock_devices',
  'walnut_imei',
  'walnut_api_key',
  'smartlock_clean_state_v5',
  'smartlock_clean_state_v6',
  'smartlock_clean_state_v7',
]

function purgeLegacyKeys() {
  try {
    if (localStorage.getItem(PURGE_KEY)) return
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k))
    localStorage.setItem(PURGE_KEY, 'true')
  } catch {
    // storage unavailable (private mode etc.)
  }
}

if (typeof window !== 'undefined') purgeLegacyKeys()

export function getRegisteredLocks(): RegisteredLock[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.imei === 'string' && l.imei) : []
  } catch {
    return []
  }
}

function save(locks: RegisteredLock[]) {
  try {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(locks))
  } catch {
    // storage unavailable - locks will need to be re-added after a server restart
  }
}

export function addRegisteredLock(lock: RegisteredLock) {
  save([lock, ...getRegisteredLocks().filter((l) => l.imei !== lock.imei)])
}

export function removeRegisteredLock(imei: string) {
  save(getRegisteredLocks().filter((l) => l.imei !== imei))
}

export function clearRegisteredLocks() {
  save([])
}
