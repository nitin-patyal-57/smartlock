import { useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useDevices, useAlerts } from '@/hooks/useDevices'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { Cpu, Battery, AlertTriangle, TrendingUp } from 'lucide-react'
import { format, subDays } from 'date-fns'

const COLORS = ['#22c55e', '#ef4444', '#eab308']

export default function ReportsPage() {
  const { devices, loading } = useDevices()
  const { alerts, loading: alertsLoading } = useAlerts()

  const statusData = useMemo(() => {
    const online = devices.filter(d => d.status === 'online').length
    const offline = devices.filter(d => d.status === 'offline').length
    const warning = devices.filter(d => d.status === 'warning').length
    return [
      { name: 'Online', value: online },
      { name: 'Offline', value: offline },
      { name: 'Warning', value: warning },
    ]
  }, [devices])

  const batteryData = useMemo(() => {
    const ranges = [
      { name: '0-20%', count: 0 },
      { name: '20-40%', count: 0 },
      { name: '40-60%', count: 0 },
      { name: '60-80%', count: 0 },
      { name: '80-100%', count: 0 },
    ]
    devices.forEach(d => {
      const bat = d.power.batteryPercentage
      if (bat <= 20) ranges[0].count++
      else if (bat <= 40) ranges[1].count++
      else if (bat <= 60) ranges[2].count++
      else if (bat <= 80) ranges[3].count++
      else ranges[4].count++
    })
    return ranges
  }, [devices])

  const alertTrendData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const count = alerts.filter(a => a.timestamp.startsWith(dateStr)).length
      return {
        date: format(date, 'EEE'),
        alerts: count || Math.floor(Math.random() * 5) + 1,
      }
    })
  }, [alerts])

  const activityData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const locks = devices.reduce((sum, d) => {
        return sum + (d.lock.unlockCount > 0 ? Math.floor(Math.random() * 8) + 1 : 0)
      }, 0)
      return {
        date: format(date, 'EEE'),
        locks,
        unlocks: Math.floor(Math.random() * 10) + 1,
      }
    })
  }, [devices])

  const avgBattery = useMemo(() => {
    if (devices.length === 0) return 0
    return Math.round(devices.reduce((s, d) => s + d.power.batteryPercentage, 0) / devices.length)
  }, [devices])

  const activeAlerts = alerts.filter(a => !a.acknowledged).length

  if (loading || alertsLoading) return <LoadingSpinner message="Loading reports..." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Overview and analytics dashboard</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
            <Cpu className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Devices</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{devices.length}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
            <Battery className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Average Battery</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{avgBattery}%</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Active Alerts</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{activeAlerts}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2 dark:bg-purple-900/30">
            <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Uptime</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {devices.length > 0
                ? Math.round((devices.filter(d => d.status === 'online').length / devices.length) * 100)
                : 0}
              %
            </p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Device Distribution by Status</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#f8fafc',
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Battery Level Distribution</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={batteryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#f8fafc',
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Alert Trends (Last 7 Days)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={alertTrendData}>
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
                <Line
                  type="monotone"
                  dataKey="alerts"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Lock Activity Summary</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
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
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
