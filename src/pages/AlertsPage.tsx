import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAlerts } from '@/hooks/useDevices'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Battery,
  Shield,
  Wifi,
  MapPin,
  Bell,
} from 'lucide-react'
import type { AlertSeverity } from '@/types/smartlock'
import { formatDistanceToNow } from 'date-fns'

type SeverityFilter = 'all' | AlertSeverity

const severityConfig: Record<AlertSeverity, { color: string; badge: 'danger' | 'warning' | 'info'; icon: React.ReactNode }> = {
  critical: {
    color: 'border-l-red-500',
    badge: 'danger',
    icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
  },
  warning: {
    color: 'border-l-amber-500',
    badge: 'warning',
    icon: <AlertCircle className="h-5 w-5 text-amber-500" />,
  },
  info: {
    color: 'border-l-blue-500',
    badge: 'info',
    icon: <Info className="h-5 w-5 text-blue-500" />,
  },
}

const typeIcons: Record<string, React.ReactNode> = {
  low_battery: <Battery className="h-4 w-4" />,
  tamper_detected: <Shield className="h-4 w-4" />,
  offline: <Wifi className="h-4 w-4" />,
  geofence_violation: <MapPin className="h-4 w-4" />,
}

export default function AlertsPage() {
  const navigate = useNavigate()
  const { alerts, loading, acknowledgeAlert } = useAlerts()
  const [filter, setFilter] = useState<SeverityFilter>('all')
  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length

  const filteredAlerts = useMemo(() => {
    let result = alerts
    if (filter !== 'all') {
      result = result.filter(a => a.severity === filter)
    }
    return result.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 }
      const sDiff = severityOrder[a.severity] - severityOrder[b.severity]
      if (sDiff !== 0) return sDiff
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
  }, [alerts, filter])

  if (loading) return <LoadingSpinner message="Loading alerts..." />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Alerts</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Monitor security and device alerts</p>
        </div>
        {unacknowledgedCount > 0 && (
          <div className="flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 dark:bg-red-900/30">
            <Bell className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              {unacknowledgedCount} unacknowledged
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {(['all', 'critical', 'warning', 'info'] as SeverityFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            {f}
            {f !== 'all' && (
              <span className="ml-1.5 text-xs opacity-70">
                ({alerts.filter(a => a.severity === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredAlerts.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-12 w-12 text-emerald-400" />}
          title="No alerts"
          description="Everything looks good! No alerts match the current filter."
        />
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map(alert => {
            const config = severityConfig[alert.severity]
            return (
              <Card
                key={alert.id}
                className={`border-l-4 ${config.color} ${alert.acknowledged ? 'opacity-60' : ''}`}
                hover
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{config.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge label={alert.severity} variant={config.badge} />
                        <span className="text-xs text-slate-400">
                          {typeIcons[alert.type] || <Info className="h-3 w-3" />}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-900 dark:text-white">{alert.message}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <button
                          onClick={() => navigate(`/locks/${alert.deviceId}`)}
                          className="font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                        >
                          {alert.deviceId}
                        </button>
                        <span>{formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.acknowledged ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Acknowledged
                      </span>
                    ) : (
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
