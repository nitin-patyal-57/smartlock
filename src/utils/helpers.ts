import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format, isValid } from 'date-fns'
import type { SmartLockDevice } from '@/types/smartlock'

export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes))
}

export function parseDateSafe(val: string | number | undefined | null): Date | null {
  if (!val) return null
  if (typeof val === 'number') {
    const d = new Date(val)
    return isValid(d) ? d : null
  }
  const str = String(val).trim()
  if (!str) return null

  if (/^\d+$/.test(str)) {
    const num = Number(str)
    const ms = str.length === 10 ? num * 1000 : num
    const d = new Date(ms)
    return isValid(d) ? d : null
  }

  const d = new Date(str)
  return isValid(d) ? d : null
}

export function formatTimeSafe(
  val: string | number | undefined | null,
  pattern = 'yyyy-MM-dd HH:mm:ss',
  fallback = 'N/A'
): string {
  const d = parseDateSafe(val)
  if (!d) return fallback
  try {
    return format(d, pattern)
  } catch {
    return fallback
  }
}

export function formatRelativeTime(
  val: string | number | undefined | null,
  fallback = 'Never'
): string {
  const d = parseDateSafe(val)
  if (!d) return fallback
  try {
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000)
    if (diffSec < 10 && diffSec >= -120) return 'Just now'
    if (diffSec < 60 && diffSec >= 10) return `${diffSec}s ago`
    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return fallback
  }
}

export function getHeadingDirection(heading: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round(((heading %= 360) < 0 ? heading + 360 : heading) / 45) % 8
  return directions[index]
}

export function formatBattery(percentage: number): string {
  if (percentage > 50) return 'text-green-500'
  if (percentage >= 20) return 'text-yellow-500'
  return 'text-red-500'
}

export function formatSignalStrength(rssi: number): { label: string; color: string } {
  if (rssi >= -60) return { label: 'Excellent', color: 'text-green-500' }
  if (rssi >= -75) return { label: 'Good', color: 'text-green-400' }
  if (rssi >= -85) return { label: 'Fair', color: 'text-yellow-500' }
  return { label: 'Poor', color: 'text-red-500' }
}

export function formatUptime(seconds: number): string {
  if (seconds <= 0) return '0m'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  return parts.join(' ')
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`
  return `${km.toFixed(1)}km`
}

export function formatSpeed(kmh: number): string {
  return `${kmh.toFixed(0)} km/h`
}

export function getDeviceStatus(device: SmartLockDevice): 'online' | 'offline' | 'warning' {
  return isDeviceOnline(device) ? (device.status || 'online') : 'offline'
}

/**
 * Check whether a device is currently online and reporting live telemetry.
 * If status is 'offline', or lastSeen is empty or older than 2 minutes (120s), the device is considered OFF.
 */
export function isDeviceOnline(device?: SmartLockDevice | null): boolean {
  if (!device) return false
  if (device.status === 'offline') return false
  if (!device.lastSeen) return false
  const d = parseDateSafe(device.lastSeen)
  if (!d) return false
  const diffMs = Date.now() - d.getTime()
  // If no ping/telemetry within the last 2 minutes, the device is considered off/offline
  if (isNaN(diffMs) || diffMs > 120000) return false
  return device.status === 'online' || device.status === 'warning'
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return '-'
  try {
    return format(new Date(isoString), 'MMM d, yyyy HH:mm')
  } catch {
    return '-'
  }
}

export function timeAgo(isoString: string): string {
  if (!isoString) return '-'
  try {
    return formatDistanceToNow(new Date(isoString), { addSuffix: true })
  } catch {
    return '-'
  }
}