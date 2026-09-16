import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'
import type { SmartLockDevice } from '@/types/smartlock'

export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes))
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
  return device.status
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