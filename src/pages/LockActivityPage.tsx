import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useDevices, useActivityEvents } from '@/hooks/useDevices'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { Lock, Unlock, Shield, Clock, Activity, Filter } from 'lucide-react'
import { format, subDays } from 'date-fns'
import type { ActivityEvent } from '@/types/smartlock'

type EventFilter = 'all' | 'lock' | 'unlock' | 'remote' | 'tamper' | 'access'

const eventIcons: Record<string, React.ReactNode> = {
  lock: <Lock className="h-4 w-4 text-red-500" />,
  unlock: <Unlock className="h-4 w-4 text-emerald-500" />,
  tamper: <Shield className="h-4 w-4 text-amber-500" />,
  remote: <Clock className="h-4 w-4 text-blue-500" />,
  access: <Activity className="h-4 w-4 text-purple-500" />,
}

const eventBgColors: Record<string, string> = {
  lock: 'bg-red-100 dark:bg-red-900/30',
  unlock: 'bg-emerald-100 dark:bg-emerald-900/30',
  tamper: 'bg-amber-100 dark:bg-amber-900/30',
  remote: 'bg-blue-100 dark:bg-blue-900/30',
  access: 'bg-purple-100 dark:bg-purple-900/30',
}

export default function LockActivityPage() {
  const { devices, loading: devicesLoading } = useDevices()
  const [selectedDevice, setSelectedDevice] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<EventFilter>('all')
  const [view, setView] = useState<'timeline' | 'chart'>('timeline')

  const { events, loading } = useActivityEvents(selectedDevice === 'all' ? undefined : selectedDevice)

  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return events
    return events.filter((e: ActivityEvent) => e.type === activeFilter)
  }, [events, activeFilter])

  const stats = useMemo(() => {
    const locks = events.filter((e: ActivityEvent) => e.type === 'lock').length
    const unlocks = events.filter((e: ActivityEvent) => e.type === 'unlock').length
    const deviceCounts: Record<string, number> = {}
    events.forEach((e: ActivityEvent) => {
      deviceCounts[e.deviceId] = (deviceCounts[e.deviceId] || 0) + 1
    })
    const mostActive = Object.entries(deviceCounts).sort((a: [string, number], b: [string, number]) => b[1] - a[1])[0]
    const methodCounts: Record<string, number> = {}
    events.forEach((e: ActivityEvent) => {
      const method = (e.metadata?.method as string) || 'unknown'
      methodCounts[method] = (methodCounts[method] || 0) + 1
    })
    const mostCommon = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0]
    return {
      locks,
      unlocks,
      mostActiveDevice: mostActive ? mostActive[0] : 'N/A',
      mostCommonMethod: mostCommon ? mostCommon[0] : 'N/A',
    }
  }, [events])

  const chartData = useMemo(() => {
    const last7 = Array.from({ length: 7 }, (_, i: number) => {
      const date = subDays(new Date(), 6 - i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const dayEvents = events.filter((e: ActivityEvent) => e.timestamp.startsWith(dateStr))
      return {
        date: format(date, 'EEE'),
        locks: dayEvents.filter((e: ActivityEvent) => e.type === 'lock').length,
        unlocks: dayEvents.filter((e: ActivityEvent) => e.type === 'unlock').length,
      }
    })
    return last7
  }, [events])

  if (devicesLoading || loading) return <LoadingSpinner message="Loading activity..." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Lock Activity</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Track lock and unlock events</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <select
            value={selectedDevice}
            onChange={e => setSelectedDevice(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            <option value="all">All Devices</option>
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.deviceName}
              </option>
            ))}
          </select>

          <div className="flex rounded-lg border border-slate-300 dark:border-slate-600">
            <button
              onClick={() => setView('timeline')}
              className={`px-3 py-1.5 text-sm rounded-l-lg ${
                view === 'timeline'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setView('chart')}
              className={`px-3 py-1.5 text-sm rounded-r-lg ${
                view === 'chart'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-slate-600 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              Chart
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          {(['all', 'lock', 'unlock', 'remote', 'tamper', 'access'] as EventFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                activeFilter === f
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3">
          <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
            <Lock className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Locks</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{stats.locks}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
            <Unlock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Unlocks</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{stats.unlocks}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Most Active</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{stats.mostActiveDevice}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
            <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Common Method</p>
            <p className="text-sm font-semibold text-slate-900 dark:text-white capitalize">{stats.mostCommonMethod}</p>
          </div>
        </Card>
      </div>

      {view === 'chart' ? (
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Lock/Unlock Frequency (Last 7 Days)</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#f8fafc',
                  }}
                />
                <Bar dataKey="locks" fill="#ef4444" name="Locks" radius={[4, 4, 0, 0]} />
                <Bar dataKey="unlocks" fill="#22c55e" name="Unlocks" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      ) : (
        <Card>
          {filteredEvents.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-12 w-12" />}
              title="No events found"
              description="No activity matches the current filter."
            />
          ) : (
            <div className="relative ml-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-6 py-2">
              {filteredEvents.slice(0, 50).map((event: ActivityEvent, idx: number) => (
                <div key={event.id} className="relative pl-6">
                  <div
                    className={`absolute -left-[11px] top-1 flex h-5 w-5 items-center justify-center rounded-full ${eventBgColors[event.type] || 'bg-slate-100 dark:bg-slate-800'}`}
                  >
                    {eventIcons[event.type] || <Activity className="h-4 w-4 text-slate-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {event.message}
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>{event.deviceId}</span>
                      <span className="capitalize">{event.type}</span>
                      <span>{new Date(event.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
