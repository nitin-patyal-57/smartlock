import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDevices } from '@/hooks/useDevices'
import type { SmartLockDevice } from '@/types/smartlock'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import BatteryIndicator from '@/components/ui/BatteryIndicator'
import SignalIndicator from '@/components/ui/SignalIndicator'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorState from '@/components/ui/ErrorState'
import EmptyState from '@/components/ui/EmptyState'
import AddDeviceModal from '@/components/devices/AddDeviceModal'
import OfflineDeviceModal from '@/components/devices/OfflineDeviceModal'
import ToastNotification from '@/components/ui/ToastNotification'
import {
  Search,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Plus,
  Trash2,
  Lock,
  Unlock,
  MapPin,
  Clock,
  Compass,
  Navigation,
  Radio,
  Gauge,
  RotateCcw,
} from 'lucide-react'
import { deviceService } from '@/services/deviceService'
import { cn, getHeadingDirection, formatTimeSafe, formatRelativeTime, isDeviceOnline } from '@/utils/helpers'

type FilterType = 'all' | 'moving' | 'stationary' | 'online' | 'locked' | 'unlocked' | 'lowBattery'

export default function SmartLocksPage() {
  const { devices, loading, error, refetch, addDevice, deleteDevice } = useDevices()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [filter, setFilter] = useState<FilterType>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [offlineDevice, setOfflineDevice] = useState<SmartLockDevice | null>(null)
  const [toastMessage, setToastMessage] = useState<{ title: string; subtitle?: string } | null>(null)
  const [, setTick] = useState(0)

  const handleDeviceCardClick = (d: SmartLockDevice) => {
    const isOnline = isDeviceOnline(d)
    if (!isOnline) {
      setOfflineDevice(d)
      setToastMessage({
        title: `Device "${d.deviceName || d.deviceId}" is Offline`,
        subtitle: `IMEI ${d.deviceId} is not broadcasting live MQTT telemetry. Overview is available once online.`,
      })
      return
    }
    navigate(`/locks/${d.deviceId}`)
  }

  // Auto-tick every 5 seconds to keep relative time fresh ("Just now", "5s ago", etc.)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 5000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const q = searchParams.get('search')
    if (q !== null) setSearch(q)
  }, [searchParams])

  const filtered = useMemo(() => {
    return devices.filter((d) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        d.deviceId.toLowerCase().includes(q) ||
        (d.deviceName && d.deviceName.toLowerCase().includes(q)) ||
        (d.device?.modelId && d.device.modelId.toLowerCase().includes(q)) ||
        (d.device?.serialNumber && d.device.serialNumber.toLowerCase().includes(q)) ||
        (d.cellular?.operator && d.cellular.operator.toLowerCase().includes(q))

      if (!matchSearch) return false

      const isOnline = isDeviceOnline(d)
      const isMoving = isOnline && ((d.gps?.speed || 0) > 1.5 || d.accelerometer?.motion === true)

      switch (filter) {
        case 'moving': return isMoving
        case 'stationary': return isOnline && !isMoving
        case 'online': return isOnline
        case 'locked': return isOnline && Boolean(d.lock?.lockStatus)
        case 'unlocked': return isOnline && !d.lock?.lockStatus
        case 'lowBattery': return isOnline && Boolean(d.power?.isLowBattery || (d.power?.batteryPercentage ?? 100) < 20)
        default: return true
      }
    })
  }, [devices, search, filter])

  const handleDelete = async (e: React.MouseEvent, device: SmartLockDevice) => {
    e.stopPropagation()
    const confirmDelete = window.confirm(
      `Remove smart lock "${device.deviceName || device.deviceId}" (IMEI: ${device.deviceId}) from the dashboard?`
    )
    if (!confirmDelete) return

    setDeletingId(device.deviceId)
    try {
      await deleteDevice(device.deviceId)
    } catch (err) {
      window.alert(`Could not remove the lock: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleClearAll = async () => {
    const confirmClear = window.confirm(
      'Remove ALL smart locks from the dashboard? Their MQTT subscriptions, history, alerts and activity will be deleted.'
    )
    if (!confirmClear) return

    try {
      await deviceService.clearAllDevices()
    } catch (err) {
      window.alert(`Could not clear locks: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  if (loading) return <LoadingSpinner message="Loading smart locks..." className="min-h-[60vh]" />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All Locks' },
    { key: 'moving', label: 'Moving' },
    { key: 'stationary', label: 'Parked' },
    { key: 'online', label: 'Online' },
    { key: 'locked', label: 'Locked' },
    { key: 'unlocked', label: 'Unlocked' },
    { key: 'lowBattery', label: 'Low Battery' },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            Smart Locks
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filtered.length} active lock device{filtered.length !== 1 ? 's' : ''} in fleet
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleClearAll}
            title="Remove all older data and reset dashboard"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-xs hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Remove All Locks</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Lock</span>
          </button>

          <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2.5">
            <button
              onClick={() => setView('grid')}
              title="Grid View"
              className={`rounded-lg p-2 transition ${
                view === 'grid'
                  ? 'bg-emerald-500/20 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 font-bold'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              title="List View"
              className={`rounded-lg p-2 transition ${
                view === 'list'
                  ? 'bg-emerald-500/20 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 font-bold'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by IMEI, Name, Model, or Operator..."
          className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-[#0d1629] dark:text-white dark:placeholder-slate-500 shadow-xs"
        />
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {filterButtons.map((btn) => (
          <button
            key={btn.key}
            onClick={() => setFilter(btn.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
              filter === btn.key
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black shadow-md shadow-emerald-500/25 border-transparent'
                : 'bg-white dark:bg-[#0d1629] text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Device List or Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Lock className="h-10 w-10 text-emerald-500/60" />}
          title={devices.length === 0 ? "No smart locks registered yet" : "No smart locks match your filters"}
          description={devices.length === 0 ? "Click '+ Add Lock' to register your device IMEI and stream live telemetry via MQTT." : "Try clearing search or registering a new lock device."}
          action={
            devices.length === 0 ? (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-2 flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Add Lock</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearch('')
                  setFilter('all')
                }}
                className="mt-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
              >
                Clear Search
              </button>
            )
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const isOnline = isDeviceOnline(d)
            const isMoving = isOnline && ((d.gps?.speed || 0) > 1.5 || d.accelerometer?.motion === true)

            return (
              <div
                key={d.deviceId}
                onClick={() => handleDeviceCardClick(d)}
                className="group relative cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0b1324] p-5 md:p-6 transition-all duration-200 hover:border-slate-400 dark:hover:border-slate-700 shadow-md dark:shadow-black/40 hover:shadow-xl"
              >
                {/* Header: Title, IMEI & Status Pill + Trash */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base md:text-lg font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {d.deviceName || d.deviceId}
                    </h3>
                    <p className="mt-0.5 font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                      IMEI: {d.deviceId}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border',
                        isOnline
                          ? isMoving
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50'
                            : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-[#132238] dark:text-[#38bdf8] dark:border-[#1e3a5f]'
                          : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50'
                      )}
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          isOnline
                            ? isMoving
                              ? 'bg-emerald-500 animate-pulse'
                              : 'bg-sky-500 dark:bg-[#38bdf8]'
                            : 'bg-rose-500 dark:bg-rose-400'
                        )}
                      />
                      <span>{isOnline ? (isMoving ? 'Moving' : 'Parked') : 'Offline'}</span>
                    </span>

                    <button
                      onClick={(e) => handleDelete(e, d)}
                      disabled={deletingId === d.deviceId}
                      title="Remove smart lock"
                      className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* 3 Metric Boxes (Speed, Satellites, Heading) */}
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl bg-slate-50 dark:bg-[#131d31] p-3 text-center border border-slate-200 dark:border-slate-800/60">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">Speed</span>
                    <p className="mt-1 font-mono text-sm md:text-base font-black text-slate-900 dark:text-white">
                      {isOnline ? `${(d.gps?.speed || 0).toFixed(1)} km/h` : '0.0 km/h'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-[#131d31] p-3 text-center border border-slate-200 dark:border-slate-800/60">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">Satellites</span>
                    <p className="mt-1 font-mono text-sm md:text-base font-black text-blue-600 dark:text-[#38bdf8]">
                      {isOnline && d.gps?.satellites !== undefined ? d.gps.satellites : 0}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-[#131d31] p-3 text-center border border-slate-200 dark:border-slate-800/60">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block uppercase tracking-wider">Heading</span>
                    <p className="mt-1 font-mono text-sm md:text-base font-black text-slate-900 dark:text-white">
                      {isOnline && d.gps?.heading !== undefined
                        ? `${Math.round(d.gps.heading)}° ${getHeadingDirection(d.gps.heading)}`
                        : '0° N'}
                    </p>
                  </div>
                </div>

                {/* Coords & Carrier */}
                <div className="mt-3.5 space-y-1 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Coords:</span>{' '}
                    <span className="font-mono text-slate-900 dark:text-slate-200 font-bold">
                      {isOnline && d.gps?.latitude
                        ? `${d.gps.latitude.toFixed(5)}, ${d.gps.longitude.toFixed(5)}`
                        : d.gps?.lastLocation || '30.65695, 76.72962'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Carrier:</span>{' '}
                    <span className="text-slate-900 dark:text-slate-200 font-bold">
                      {d.cellular?.operator || 'JIO 4G'} ({d.cellular?.networkType || 'LTE'})
                    </span>
                  </div>
                </div>

                {/* Last Seen Bar */}
                <div className="mt-3.5 flex items-center justify-between rounded-xl bg-slate-50 dark:bg-[#09101f] border border-slate-200 dark:border-slate-800/80 px-3.5 py-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                    <Clock className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Last Seen:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {isOnline ? formatRelativeTime(d.lastSeen) : 'Offline'}
                    </span>
                  </div>
                  <span className="font-mono text-slate-600 dark:text-slate-400 font-bold text-[11px]">
                    {d.lastSeen ? formatTimeSafe(d.lastSeen, 'HH:mm:ss') : '--:--:--'}
                  </span>
                </div>

                {/* Bottom Row: Battery % (Voltage) & Signal Good */}
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-base font-black text-slate-900 dark:text-white">
                      {d.power?.batteryPercentage ?? 0}%
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                      ({(d.power?.batteryVoltage ?? 3.68).toFixed(2)}V)
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <SignalIndicator
                      rssi={isOnline ? (d.cellular?.rssi ?? 70) : -120}
                      signalQuality={isOnline ? (d.cellular?.signalQuality ?? 4) : 0}
                      signalText={isOnline ? (d.cellular?.signal || 'GOOD') : 'OFFLINE'}
                      size="sm"
                      showText
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/50">
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Lock Device</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Movement</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Lock Status</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Speed</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">GPS Fix</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Battery</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Network</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300">Last Seen</th>
                  <th className="px-4 py-3 font-bold text-slate-600 dark:text-slate-300 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((d) => {
                  const isOnline = isDeviceOnline(d)
                  const isMoving = isOnline && ((d.gps?.speed || 0) > 1.5 || d.accelerometer?.motion === true)

                  return (
                    <tr
                      key={d.deviceId}
                      onClick={() => handleDeviceCardClick(d)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition"
                    >
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-900 dark:text-slate-100">{d.deviceName || d.deviceId}</p>
                        <p className="font-mono text-[11px] text-slate-400">IMEI: {d.deviceId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={isOnline ? (isMoving ? 'Moving' : 'Parked') : 'Offline'}
                          variant={isOnline ? (isMoving ? 'success' : 'info') : 'danger'}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-medium">
                          {isOnline ? (
                            d.lock?.lockStatus ? (
                              <>
                                <Lock className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-emerald-600 dark:text-emerald-400">Locked</span>
                              </>
                            ) : (
                              <>
                                <Unlock className="h-3.5 w-3.5 text-amber-500" />
                                <span className="text-amber-600 dark:text-amber-400">Unlocked</span>
                              </>
                            )
                          ) : (
                            <span className="text-slate-400 font-mono">N/A</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {isOnline ? `${(d.gps?.speed || 0).toFixed(1)} km/h` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {isOnline && d.gps?.satellites ? `${d.gps.satellites} Sats (${d.gps.fixType || '3D'})` : 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        {isOnline ? (
                          <BatteryIndicator
                            level={d.power?.batteryPercentage ?? 0}
                            size="sm"
                            showLabel
                          />
                        ) : (
                          <span className="text-slate-400 font-mono">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isOnline ? (
                          <SignalIndicator
                            rssi={d.cellular?.rssi ?? 0}
                            signalQuality={d.cellular?.signalQuality ?? 0}
                            signalText={d.cellular?.signal}
                            size="sm"
                            showText
                          />
                        ) : (
                          <span className="text-slate-400">Offline</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                          {isOnline ? formatRelativeTime(d.lastSeen) : 'Device Offline'}
                        </p>
                        {isOnline && d.lastSeen && (
                          <p className="font-mono text-[10px] text-slate-400">
                            {formatTimeSafe(d.lastSeen, 'yyyy-MM-dd HH:mm:ss')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => handleDelete(e, d)}
                          disabled={deletingId === d.deviceId}
                          title="Remove smart lock"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Device Modal */}
      <AddDeviceModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onDeviceAdded={(dev) => {
          navigate(`/locks/${dev.deviceId}`)
        }}
        addDeviceFn={addDevice}
      />

      {/* Offline Device Alert Modal */}
      <OfflineDeviceModal
        device={offlineDevice}
        onClose={() => setOfflineDevice(null)}
      />

      {/* Toast Notification */}
      <ToastNotification
        isOpen={!!toastMessage}
        message={toastMessage?.title || ''}
        submessage={toastMessage?.subtitle}
        onClose={() => setToastMessage(null)}
      />
    </div>
  )
}
