import { useState, useMemo, useEffect } from 'react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts'
import { useDevices, useLocationHistory } from '@/hooks/useDevices'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { Battery, TrendingDown, Clock, Zap, Cpu, RefreshCw, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { isDeviceOnline } from '@/utils/helpers'

export default function BatteryHistoryPage() {
  const { devices, loading: devicesLoading } = useDevices()
  const [selectedDevice, setSelectedDevice] = useState<string>('')

  // Auto-select first device if none selected
  useEffect(() => {
    if (!selectedDevice && devices.length > 0) {
      setSelectedDevice(devices[0].deviceId)
    }
  }, [devices, selectedDevice])

  const { history, loading: historyLoading } = useLocationHistory(selectedDevice)

  const device = useMemo(
    () => devices.find((d) => d.deviceId === selectedDevice),
    [devices, selectedDevice]
  )

  const isOnline = device ? isDeviceOnline(device) : false

  // Process REAL telemetry history records for battery
  const batteryData = useMemo(() => {
    if (!history || history.length === 0) return []

    // Sort by timestamp ascending
    const sorted = [...history]
      .filter((h) => h.batteryPercentage !== undefined && h.batteryPercentage !== null)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return sorted.map((h) => ({
      time: format(new Date(h.timestamp), 'MMM dd, HH:mm'),
      rawTime: h.timestamp,
      battery: Number(h.batteryPercentage),
      voltage: h.batteryVoltage !== undefined ? Number(h.batteryVoltage) : undefined,
    }))
  }, [history])

  // Current real battery status
  const currentBattery = useMemo(() => {
    if (device?.power?.batteryPercentage !== undefined && device?.power?.batteryPercentage !== null) {
      return device.power.batteryPercentage
    }
    if (batteryData.length > 0) {
      return batteryData[batteryData.length - 1].battery
    }
    return null
  }, [device, batteryData])

  const currentVoltage = useMemo(() => {
    if (device?.power?.batteryVoltage !== undefined && device?.power?.batteryVoltage !== null) {
      return device.power.batteryVoltage
    }
    if (batteryData.length > 0 && batteryData[batteryData.length - 1].voltage !== undefined) {
      return batteryData[batteryData.length - 1].voltage
    }
    return null
  }, [device, batteryData])

  // Real average drain calculation per day from real history data
  const avgDrain = useMemo(() => {
    if (batteryData.length < 2) return null
    const first = batteryData[0]
    const last = batteryData[batteryData.length - 1]
    const timeDiffDays =
      (new Date(last.rawTime).getTime() - new Date(first.rawTime).getTime()) / (1000 * 60 * 60 * 24)

    if (timeDiffDays < 0.04) {
      // Less than an hour of data: calculate hourly drain and scale
      const timeDiffHours =
        (new Date(last.rawTime).getTime() - new Date(first.rawTime).getTime()) / (1000 * 60 * 60)
      if (timeDiffHours < 0.1) return null
      const drain = ((first.battery - last.battery) / timeDiffHours) * 24
      return `${drain > 0 ? '-' : '+'}${Math.abs(drain).toFixed(1)}%/day`
    }

    const drain = (first.battery - last.battery) / timeDiffDays
    return `${drain > 0 ? '-' : '+'}${Math.abs(drain).toFixed(1)}%/day`
  }, [batteryData])

  // Real estimated time remaining
  const estimatedHours = useMemo(() => {
    if (currentBattery === null || currentBattery <= 0) return null
    if (batteryData.length < 2) return null

    const first = batteryData[0]
    const last = batteryData[batteryData.length - 1]
    const timeDiffHours =
      (new Date(last.rawTime).getTime() - new Date(first.rawTime).getTime()) / (1000 * 60 * 60)

    if (timeDiffHours < 0.1) return null
    const drop = first.battery - last.battery
    if (drop <= 0) return null // Battery not draining or is charging

    const drainPerHour = drop / timeDiffHours
    const hoursLeft = Math.round(currentBattery / drainPerHour)
    return hoursLeft > 0 && hoursLeft < 10000 ? `${hoursLeft}h` : null
  }, [currentBattery, batteryData])

  // Real charge cycle count: count jumps of >= 10% in battery level
  const chargeCycles = useMemo(() => {
    if (batteryData.length < 2) return 0
    let count = 0
    for (let i = 1; i < batteryData.length; i++) {
      if (batteryData[i].battery >= batteryData[i - 1].battery + 10) {
        count++
      }
    }
    return count
  }, [batteryData])

  if (devicesLoading) return <LoadingSpinner message="Loading registered smart locks..." />

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Battery History
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Monitor real-time battery voltage, discharge rates, and live MQTT battery telemetry
          </p>
        </div>
      </div>

      {/* Select Device Selector */}
      <Card padding="md">
        <label className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Select Smart Lock
        </label>
        {devices.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No smart lock devices registered yet. Click &quot;Add Lock&quot; in Smart Locks page to register an IMEI.
          </p>
        ) : (
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full max-w-md rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            {devices.map((d) => {
              const hasCustomName = Boolean(
                d.deviceName &&
                !d.deviceName.toLowerCase().startsWith('smartlock-') &&
                d.deviceName !== d.deviceId
              )
              return (
                <option key={d.deviceId} value={d.deviceId}>
                  {hasCustomName ? `${d.deviceName} (IMEI: ${d.deviceId})` : `IMEI: ${d.deviceId}`}
                </option>
              )
            })}
          </select>
        )}
      </Card>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Current Battery */}
        <Card className="flex items-center gap-3.5">
          <div className="rounded-xl bg-emerald-50 p-2.5 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
            <Battery className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Current Battery</p>
            <p className="text-lg font-black font-mono text-slate-900 dark:text-white">
              {currentBattery !== null ? `${currentBattery.toFixed(0)}%` : 'N/A'}
            </p>
            {currentVoltage !== null && currentVoltage !== undefined && (
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-semibold">
                {currentVoltage.toFixed(2)}V
              </p>
            )}
          </div>
        </Card>

        {/* Card 2: Avg Drain / Day */}
        <Card className="flex items-center gap-3.5">
          <div className="rounded-xl bg-rose-50 p-2.5 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Avg Drain / Day</p>
            <p className="text-lg font-black font-mono text-slate-900 dark:text-white">
              {avgDrain || 'N/A'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {batteryData.length >= 2 ? `From ${batteryData.length} records` : 'Awaiting history'}
            </p>
          </div>
        </Card>

        {/* Card 3: Estimated Time Remaining */}
        <Card className="flex items-center gap-3.5">
          <div className="rounded-xl bg-sky-50 p-2.5 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/30">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Est. Time Left</p>
            <p className="text-lg font-black font-mono text-slate-900 dark:text-white">
              {estimatedHours || 'N/A'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {isOnline ? 'Online telemetry' : 'Device offline'}
            </p>
          </div>
        </Card>

        {/* Card 4: Charge Cycles */}
        <Card className="flex items-center gap-3.5">
          <div className="rounded-xl bg-amber-50 p-2.5 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Charge Cycles</p>
            <p className="text-lg font-black font-mono text-slate-900 dark:text-white">
              {chargeCycles}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Recharge sessions
            </p>
          </div>
        </Card>
      </div>

      {/* Battery Level Over Time Chart */}
      <Card padding="lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              Battery Level Over Time
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {selectedDevice ? `Real-time recorded telemetry for IMEI: ${selectedDevice}` : 'Select a device'}
            </p>
          </div>

          {selectedDevice && (
            <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
              Topic: soundbox_dev/{selectedDevice}/metrics
            </span>
          )}
        </div>

        {historyLoading ? (
          <div className="py-20 flex justify-center items-center">
            <LoadingSpinner message="Fetching live battery history..." />
          </div>
        ) : batteryData.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 mb-3">
              <Battery className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              No Battery History Recorded Yet
            </h4>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              This device has not transmitted historical battery data to SQLite yet. Live battery
              percentage will automatically graph here in real-time as the smart lock transmits telemetry over MQTT.
            </p>
          </div>
        ) : (
          <div className="h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={batteryData}>
                <defs>
                  <linearGradient id="batteryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11 }}
                  stroke="#94a3b8"
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0d1629',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                  formatter={(value: any, name: any) => [
                    `${value}%`,
                    name === 'battery' ? 'Battery Level' : name,
                  ]}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <ReferenceLine
                  y={20}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  label={{ value: 'Low Battery (20%)', fill: '#ef4444', fontSize: 11, fontWeight: 700 }}
                />
                <Area
                  type="monotone"
                  dataKey="battery"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#batteryGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  )
}
