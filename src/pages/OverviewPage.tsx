import { useMemo } from 'react'
import { useDevices, useActivityEvents, useAlerts } from '@/hooks/useDevices'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import BatteryIndicator from '@/components/ui/BatteryIndicator'
import SignalIndicator from '@/components/ui/SignalIndicator'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorState from '@/components/ui/ErrorState'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  Cpu, Wifi, WifiOff, AlertTriangle,
  Lock, Unlock, Activity, Shield
} from 'lucide-react'
import { isDeviceOnline } from '@/utils/helpers'

function getBatteryColor(pct: number) {
  if (pct > 50) return '#10b981'
  if (pct > 20) return '#f59e0b'
  return '#ef4444'
}

export default function OverviewPage() {
  const { devices, loading: devicesLoading, error: devicesError, refetch: refetchDevices } = useDevices()
  const { events, loading: eventsLoading, error: eventsError, refetch: refetchEvents } = useActivityEvents()
  const { alerts, loading: alertsLoading, error: alertsError, refetch: refetchAlerts } = useAlerts()
  const navigate = useNavigate()

  const batteryData = useMemo(() => devices
    .filter((d) => isDeviceOnline(d) && (d.power?.batteryPercentage ?? 0) > 0)
    .map((d) => ({
      name: d.deviceId,
      battery: d.power.batteryPercentage,
    })), [devices])

  const recentEvents = useMemo(() => [...events]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10), [events])

  if (devicesLoading || eventsLoading || alertsLoading) {
    return <LoadingSpinner message="Loading dashboard..." className="min-h-[60vh]" />
  }

  if (devicesError || eventsError || alertsError) {
    return (
      <ErrorState
        message={devicesError || eventsError || alertsError || 'Failed to load data'}
        onRetry={() => { refetchDevices(); refetchEvents(); refetchAlerts() }}
      />
    )
  }

  const onlineCount = devices.filter((d) => isDeviceOnline(d)).length
  const offlineCount = devices.filter((d) => !isDeviceOnline(d)).length
  const activeAlerts = alerts.filter((a) => !a.acknowledged)
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical' || a.severity === 'warning').slice(0, 5)

  const statCards = [
    {
      label: 'Total Devices',
      value: devices.length,
      icon: <Cpu className="h-6 w-6 text-blue-500 dark:text-blue-400" />,
      gradient: 'from-blue-600/20 via-indigo-600/10 to-transparent border-blue-500/30 dark:border-blue-500/40',
      badgeBg: 'bg-blue-500/15 border-blue-500/30 dark:bg-blue-500/25 dark:border-blue-500/50 shadow-sm shadow-blue-500/25',
      textColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Online Locks',
      value: onlineCount,
      icon: <Wifi className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />,
      gradient: 'from-emerald-600/20 via-teal-600/10 to-transparent border-emerald-500/30 dark:border-emerald-500/40',
      badgeBg: 'bg-emerald-500/15 border-emerald-500/30 dark:bg-emerald-500/25 dark:border-emerald-500/50 shadow-sm shadow-emerald-500/25',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Offline Locks',
      value: offlineCount,
      icon: <WifiOff className="h-6 w-6 text-rose-500 dark:text-rose-400" />,
      gradient: 'from-rose-600/20 via-red-600/10 to-transparent border-rose-500/30 dark:border-rose-500/40',
      badgeBg: 'bg-rose-500/15 border-rose-500/30 dark:bg-rose-500/25 dark:border-rose-500/50 shadow-sm shadow-rose-500/25',
      textColor: 'text-rose-600 dark:text-rose-400',
    },
    {
      label: 'Active Alerts',
      value: activeAlerts.length,
      icon: <AlertTriangle className="h-6 w-6 text-amber-500 dark:text-amber-400" />,
      gradient: 'from-amber-600/20 via-orange-600/10 to-transparent border-amber-500/30 dark:border-amber-500/40',
      badgeBg: 'bg-amber-500/15 border-amber-500/30 dark:bg-amber-500/25 dark:border-amber-500/50 shadow-sm shadow-amber-500/25',
      textColor: 'text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Dashboard Overview</h1>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Real-time smart lock monitoring & cellular diagnostics</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} padding="none" className={`overflow-hidden border bg-gradient-to-br ${card.gradient}`}>
            <div className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-extrabold tracking-wider text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className={`mt-1.5 text-3xl font-black tracking-tight ${card.textColor}`}>{card.value}</p>
              </div>
              <div className={`rounded-xl p-3 border ${card.badgeBg}`}>
                {card.icon}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padding="md">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Battery Levels</h2>
          {batteryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={batteryData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#f1f5f9',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [`${value}%`, 'Battery']}
                />
                <Bar dataKey="battery" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {batteryData.map((entry, idx) => (
                    <Cell key={idx} fill={getBatteryColor(entry.battery)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">No device data</p>
          )}
        </Card>

        <Card padding="md">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Activity</h2>
          <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50"
                >
                  <Activity className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{event.message}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {event.deviceId} &middot;{' '}
                      {format(new Date(event.timestamp), 'MMM d, HH:mm')}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">No recent events</p>
            )}
          </div>
        </Card>
      </div>

      <Card padding="md">
        <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Device Overview</h2>
        {devices.length === 0 ? (
          <div className="py-8 text-center text-slate-500">
            <p className="text-sm font-medium">No smart locks registered yet.</p>
            <p className="text-xs text-slate-400 mt-1">Go to "Smart Locks" and click "Add Lock" to register your device.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {devices.map((device) => {
              const isOnline = isDeviceOnline(device)
              return (
                <div
                  key={device.deviceId}
                  onClick={() => navigate(`/locks/${device.deviceId}`)}
                  className="flex items-center gap-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#121c35] p-3.5 transition-all duration-200 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-black/20 cursor-pointer"
                >
                  <div className="relative flex-shrink-0">
                    {isOnline ? (
                      device.lock?.lockStatus ? (
                        <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <Lock className="h-6 w-6" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <Unlock className="h-6 w-6" />
                        </div>
                      )
                    ) : (
                      <div className="p-2 rounded-xl bg-slate-500/10 text-slate-400 border border-slate-700/40">
                        <Lock className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {device.deviceName}
                    </p>
                    <p className="font-mono text-xs font-semibold text-slate-400 truncate">
                      {device.deviceId}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      {isOnline ? (
                        <>
                          <BatteryIndicator level={device.power?.batteryPercentage ?? 0} size="sm" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{device.power?.batteryPercentage ?? 0}%</span>
                        </>
                      ) : (
                        <span className="text-xs text-rose-500 dark:text-rose-400 font-bold">Offline</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isOnline ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50' : 'bg-rose-500 shadow-xs shadow-rose-500/50'
                      }`}
                    />
                    {isOnline ? (
                      <SignalIndicator rssi={device.cellular?.rssi ?? 0} signalQuality={device.cellular?.signalQuality ?? 0} size="sm" />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">Offline</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {criticalAlerts.length > 0 && (
        <Card padding="md">
          <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
            <span className="inline-flex items-center gap-2">
              <Shield className="h-5 w-5 text-amber-500" />
              Alert Summary
            </span>
          </h2>
          <div className="space-y-2">
            {criticalAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle
                    className={`h-4 w-4 flex-shrink-0 ${
                      alert.severity === 'critical' ? 'text-red-500' : 'text-amber-500'
                    }`}
                  />
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{alert.message}</p>
                    <p className="text-xs text-slate-400">{alert.deviceId}</p>
                  </div>
                </div>
                <StatusBadge
                  label={alert.severity}
                  variant={alert.severity === 'critical' ? 'danger' : 'warning'}
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
