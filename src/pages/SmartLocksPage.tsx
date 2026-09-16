import { useState, useMemo } from 'react'
import { useDevices } from '@/hooks/useDevices'
import type { SmartLockDevice } from '@/types/smartlock'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import BatteryIndicator from '@/components/ui/BatteryIndicator'
import SignalIndicator from '@/components/ui/SignalIndicator'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorState from '@/components/ui/ErrorState'
import EmptyState from '@/components/ui/EmptyState'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Search, LayoutGrid, List, Lock, Unlock,
  MapPin, Clock, Filter, SlidersHorizontal
} from 'lucide-react'

type FilterType = 'all' | 'online' | 'offline' | 'lowBattery' | 'tamper'
type SortKey = 'deviceId' | 'battery' | 'status' | 'lockStatus' | 'signal' | 'lastSeen'

const filterButtons: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'lowBattery', label: 'Low Battery' },
  { key: 'tamper', label: 'Tamper Alert' },
]

function matchesSearch(d: SmartLockDevice, q: string) {
  if (!q) return true
  const lower = q.toLowerCase()
  return (
    d.deviceId.toLowerCase().includes(lower) ||
    d.device.serialNumber.toLowerCase().includes(lower) ||
    d.device.modelId.toLowerCase().includes(lower) ||
    (d.deviceName && d.deviceName.toLowerCase().includes(lower))
  )
}

function matchesFilter(d: SmartLockDevice, filter: FilterType) {
  switch (filter) {
    case 'online': return d.status === 'online'
    case 'offline': return d.status === 'offline'
    case 'lowBattery': return d.power.isLowBattery || d.power.batteryPercentage < 20
    case 'tamper': return d.tamper.tamperStatus
    default: return true
  }
}

function compare(a: SmartLockDevice, b: SmartLockDevice, key: SortKey, asc: boolean) {
  let cmp = 0
  switch (key) {
    case 'deviceId': cmp = a.deviceId.localeCompare(b.deviceId); break
    case 'battery': cmp = a.power.batteryPercentage - b.power.batteryPercentage; break
    case 'status': cmp = a.status.localeCompare(b.status); break
    case 'lockStatus': cmp = Number(a.lock.lockStatus) - Number(b.lock.lockStatus); break
    case 'signal': cmp = a.cellular.rssi - b.cellular.rssi; break
    case 'lastSeen': cmp = new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime(); break
  }
  return asc ? cmp : -cmp
}

export default function SmartLocksPage() {
  const { devices, loading, error, refetch } = useDevices()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [sortKey, setSortKey] = useState<SortKey>('lastSeen')
  const [sortAsc, setSortAsc] = useState(false)

  const filtered = useMemo(() => {
    return devices
      .filter((d) => matchesSearch(d, search) && matchesFilter(d, filter))
      .sort((a, b) => compare(a, b, sortKey, sortAsc))
  }, [devices, search, filter, sortKey, sortAsc])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  if (loading) return <LoadingSpinner message="Loading devices..." className="min-h-[60vh]" />
  if (error) return <ErrorState message={error} onRetry={refetch} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Smart Locks</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{filtered.length} device{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('grid')}
            className={`rounded-lg p-2 transition-colors ${
              view === 'grid'
                ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`rounded-lg p-2 transition-colors ${
              view === 'list'
                ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <List className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ID, serial number, or model..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {filterButtons.map((btn) => (
          <button
            key={btn.key}
            onClick={() => setFilter(btn.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === btn.key
                ? 'bg-primary-600 text-white dark:bg-primary-500'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<SlidersHorizontal className="h-12 w-12" />}
          title="No devices found"
          description="Try adjusting your search or filter criteria."
        />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((device) => (
            <Card key={device.deviceId} hover padding="md" onClick={() => navigate(`/locks/${device.deviceId}`)}>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {device.deviceId.slice(0, 12)}...
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{device.device.modelId}</p>
                </div>
                <StatusBadge
                  label={device.status}
                  variant={device.status === 'online' ? 'success' : device.status === 'offline' ? 'danger' : 'warning'}
                  pulse={device.status === 'online'}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Battery</span>
                  <div className="flex items-center gap-2">
                    <BatteryIndicator level={device.power.batteryPercentage} size="sm" />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {device.power.batteryPercentage}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Lock</span>
                  <div className="flex items-center gap-1.5">
                    {device.lock.lockStatus ? (
                      <Lock className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Unlock className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {device.lock.lockStatus ? 'Locked' : 'Unlocked'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Location</span>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {device.gps.lastLocation || `${device.gps.latitude.toFixed(4)}, ${device.gps.longitude.toFixed(4)}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Signal</span>
                  <SignalIndicator rssi={device.cellular.rssi} signalQuality={device.cellular.signalQuality} size="sm" />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Last Update</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {format(new Date(device.lastSeen), 'MMM d, HH:mm')}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                  {[
                    { key: 'deviceId' as SortKey, label: 'Device ID' },
                    { key: 'battery' as SortKey, label: 'Battery' },
                    { key: 'status' as SortKey, label: 'Status' },
                    { key: 'lockStatus' as SortKey, label: 'Lock' },
                    { key: 'signal' as SortKey, label: 'Signal' },
                    { key: 'lastSeen' as SortKey, label: 'Last Update' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="cursor-pointer px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key && (
                          <span className="text-primary-500">{sortAsc ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filtered.map((device) => (
                  <tr
                    key={device.deviceId}
                    onClick={() => navigate(`/locks/${device.deviceId}`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-mono font-medium text-slate-900 dark:text-slate-100">
                          {device.deviceId.slice(0, 16)}
                        </p>
                        <p className="text-xs text-slate-500">{device.device.modelId}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BatteryIndicator level={device.power.batteryPercentage} size="sm" />
                        <span className="text-xs font-medium">{device.power.batteryPercentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={device.status}
                        variant={device.status === 'online' ? 'success' : device.status === 'offline' ? 'danger' : 'warning'}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {device.lock.lockStatus ? (
                          <Lock className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Unlock className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-xs">{device.lock.lockStatus ? 'Locked' : 'Unlocked'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <SignalIndicator rssi={device.cellular.rssi} signalQuality={device.cellular.signalQuality} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">
                        {format(new Date(device.lastSeen), 'MMM d, HH:mm')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
