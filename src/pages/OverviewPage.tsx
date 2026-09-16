import { useDevices, useActivityEvents, useAlerts } from '@/hooks/useDevices'
import type { AlertSeverity } from '@/types/smartlock'
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
  Lock, Unlock, MapPin, Activity, Shield
} from 'lucide-react'

const severityStyles: Record<AlertSeverity, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

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

  const onlineCount = devices.filter((d) => d.status === 'online').length
  const offlineCount = devices.filter((d) => d.status === 'offline').length
  const activeAlerts = alerts.filter((a) => !a.acknowledged)
  const criticalAlerts = activeAlerts.filter((a) => a.severity === 'critical' || a.severity === 'warning').slice(0, 5)

  const batteryData = devices.map((d) => ({
    name: d.deviceName || d.deviceId.slice(0, 8),
    battery: d.power.batteryPercentage,
  }))

  const recentEvents = [...events]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10)

  const statCards = [
    {
      label: 'Total Devices',
      value: devices.length,
      icon: <Cpu className="h-5 w-5" />,
      gradient: 'from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Online',
      value: onlineCount,
      icon: <Wifi className="h-5 w-5" />,
      gradient: 'from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Offline',
      value: offlineCount,
      icon: <WifiOff className="h-5 w-5" />,
      gradient: 'from-red-500/10 to-rose-500/10 dark:from-red-500/20 dark:to-rose-500/20',
      iconColor: 'text-red-600 dark:text-red-400',
    },
    {
      label: 'Active Alerts',
      value: activeAlerts.length,
      icon: <AlertTriangle className="h-5 w-5" />,
      gradient: 'from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Dashboard Overview</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Real-time smart lock monitoring</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} padding="md">
            <div className={`rounded-lg bg-gradient-to-br ${card.gradient} p-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                  <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">{card.value}</p>
                </div>
                <div className={`rounded-lg bg-white/80 p-2 dark:bg-slate-800/80 ${card.iconColor}`}>
                  {card.icon}
                </div>
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
                      {event.deviceId.slice(0, 8)}... &middot;{' '}
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {devices.map((device) => (
            <div
              key={device.deviceId}
              onClick={() => navigate(`/locks/${device.deviceId}`)}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-all hover:shadow-md cursor-pointer dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="relative flex-shrink-0">
                {device.lock.lockStatus ? (
                  <Lock className="h-8 w-8 text-emerald-500" />
                ) : (
                  <Unlock className="h-8 w-8 text-amber-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                  {device.deviceName || device.deviceId.slice(0, 12)}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <BatteryIndicator level={device.power.batteryPercentage} size="sm" />
                  <span className="text-xs text-slate-500">{device.power.batteryPercentage}%</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    device.status === 'online'
                      ? 'bg-emerald-500'
                      : device.status === 'offline'
                      ? 'bg-red-500'
                      : 'bg-amber-500'
                  }`}
                />
                <SignalIndicator rssi={device.cellular.rssi} signalQuality={device.cellular.signalQuality} size="sm" />
              </div>
            </div>
          ))}
        </div>
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
                    <p className="text-xs text-slate-400">{alert.deviceId.slice(0, 8)}...</p>
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
