import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts'
import { useDevices } from '@/hooks/useDevices'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { Battery, TrendingDown, Clock, Zap } from 'lucide-react'
import { format, subDays } from 'date-fns'

function generateBatteryData() {
  const data = []
  let battery = 85 + Math.random() * 15
  const now = new Date()

  for (let i = 6; i >= 0; i--) {
    const date = subDays(now, i)
    for (let h = 0; h < 24; h += 3) {
      const drain = 0.3 + Math.random() * 0.7
      battery = Math.max(5, battery - drain)

      if (Math.random() > 0.92) {
        battery = Math.min(100, battery + 15 + Math.random() * 20)
      }

      data.push({
        time: format(new Date(date.getTime() + h * 3600000), 'MMM dd HH:mm'),
        battery: Math.round(battery * 10) / 10,
      })
    }
  }
  return data
}

export default function BatteryHistoryPage() {
  const { devices, loading } = useDevices()
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const batteryData = useMemo(() => generateBatteryData(), [])

  const device = devices.find(d => d.deviceId === selectedDevice)
  const currentBattery = device?.power.batteryPercentage ?? batteryData[batteryData.length - 1]?.battery ?? 0

  const avgDrain: string = useMemo(() => {
    if (batteryData.length < 2) return '0'
    const first = batteryData[0].battery
    const last = batteryData[batteryData.length - 1].battery
    return ((first - last) / 7).toFixed(1)
  }, [batteryData])

  const estimatedHours = useMemo(() => {
    const drainPerHour = parseFloat(avgDrain) / 24
    if (drainPerHour <= 0) return Infinity
    return Math.round(currentBattery / drainPerHour)
  }, [avgDrain, currentBattery])

  if (loading) return <LoadingSpinner message="Loading devices..." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Battery History</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Monitor battery levels and drain patterns</p>
      </div>

      <Card>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Select Device</label>
        <select
          value={selectedDevice}
          onChange={e => setSelectedDevice(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
        >
          <option value="">Select a device</option>
          {devices.map(d => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.deviceName} ({d.deviceId})
            </option>
          ))}
        </select>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3">
          <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
            <Battery className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Current Battery</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{currentBattery.toFixed(0)}%</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
            <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Avg Drain / Day</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">{avgDrain}%</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Est. Time Left</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {estimatedHours === Infinity ? 'N/A' : `${estimatedHours}h`}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Charge Cycles</p>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              {batteryData.filter((d, i) => i > 0 && d.battery > batteryData[i - 1].battery + 5).length}
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Battery Level Over Time</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={batteryData}>
              <defs>
                <linearGradient id="batteryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11 }}
                tickFormatter={val => val.split(' ')[0]}
                stroke="#94a3b8"
              />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f8fafc',
                }}
                formatter={(value) => [`${value}%`, 'Battery']}
              />
              <ReferenceLine
                y={20}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{ value: 'Low Battery', fill: '#ef4444', fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="battery"
                stroke="#22c55e"
                fill="url(#batteryGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}
