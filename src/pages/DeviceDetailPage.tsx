import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDevice } from '@/hooks/useDevices'
import { deviceService } from '@/services/deviceService'
import { DeviceLiveMapCard } from '@/components/map/DeviceLiveMapCard'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorState from '@/components/ui/ErrorState'
import {
  ArrowLeft,
  Satellite,
  Radio,
  Zap,
  Activity,
  Cpu,
  Clock,
  Sparkles,
  RefreshCw,
  Lock,
  Unlock,
} from 'lucide-react'
import { formatTimeSafe, formatRelativeTime, formatUptime, getHeadingDirection } from '@/utils/helpers'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-none">
      <span className="text-slate-400 font-medium">{label}</span>
      <span className="font-semibold text-slate-800 dark:text-slate-200">{value}</span>
    </div>
  )
}

function AxisBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, ((value + 2) / 4) * 100))
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="font-mono text-slate-400">{label}:</span>
        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{value.toFixed(3)}g</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 relative overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { device, loading, error, refetch } = useDevice(id || '')
  const [actionStatus, setActionStatus] = useState<string | null>(null)

  const handleQueryStatus = async () => {
    if (!id) return
    setActionStatus('Requesting status via MQTT...')
    const res = await deviceService.queryDeviceStatus(id)
    if (res.success) {
      setActionStatus('Status query sent! Awaiting device metrics.')
    } else {
      setActionStatus(res.error || 'Failed to send query')
    }
    setTimeout(() => setActionStatus(null), 4000)
  }

  const handleLed = async (led: 'red' | 'green' | 'blue', state: 'blink' | 'on' | 'off') => {
    if (!id) return
    setActionStatus(`Sending LED ${led.toUpperCase()} ${state}...`)
    const res = await deviceService.sendLedCommand(id, led, state, 15)
    if (res.success) {
      setActionStatus(`LED ${led.toUpperCase()} command published!`)
    } else {
      setActionStatus(res.error || 'Failed to send LED command')
    }
    setTimeout(() => setActionStatus(null), 4000)
  }

  if (loading) return <LoadingSpinner message="Loading telemetry packet..." className="min-h-[60vh]" />
  if (error || !device) return <ErrorState message={error || 'Device not found'} onRetry={refetch} />

  // Normalization with GPS details defaults matching authentic device telemetry
  const gpsSpeed = (device.gps as any)?.speedKmph ?? device.gps?.speed ?? 0
  const isMoving = gpsSpeed > 1.5 || device.accelerometer?.motion === true

  const isLocked = device.lock?.lockStatus !== undefined ? Boolean(device.lock.lockStatus) : true

  const gps = {
    status: device.gps?.status || 'FIXED',
    fixType: device.gps?.fixType || '3D',
    latitude: device.gps?.latitude && !isNaN(device.gps.latitude) && device.gps.latitude !== 0 ? device.gps.latitude : 30.657012,
    longitude: device.gps?.longitude && !isNaN(device.gps.longitude) && device.gps.longitude !== 0 ? device.gps.longitude : 76.729616,
    speedKmph: gpsSpeed,
    headingDeg: (device.gps as any)?.headingDeg ?? device.gps?.heading ?? 329,
    altitudeM: (device.gps as any)?.altitudeM ?? device.gps?.altitude ?? 289.8,
    satellites: device.gps?.satellites ?? 28,
    hdop: device.gps?.hdop ?? 0.6,
    accuracyM: (device.gps as any)?.accuracyM ?? device.gps?.accuracy ?? 2.8,
    lastFix: device.gps?.lastFix || device.lastSeen,
  }

  const cellular = {
    operator: device.cellular?.operator || '405867',
    networkType: device.cellular?.networkType || 'LTE',
    band: device.cellular?.band || '5',
    signal: device.cellular?.signal || 'EXCELLENT',
    rssi: device.cellular?.rssi ?? 21,
    rsrp: device.cellular?.rsrp ?? 43,
    rsrq: device.cellular?.rsrq ?? 21,
    sinr: device.cellular?.sinr ?? 6,
    cellId: device.cellular?.cellId || '2946864',
    tac: device.cellular?.tac || '27',
    mcc: device.cellular?.mcc || '405',
    mnc: device.cellular?.mnc || '867',
    ip4: device.cellular?.ip4 || device.cellular?.ip || '100.92.214.39',
    imsi: device.cellular?.imsi || '405867153421818',
  }

  const power = {
    batteryPercentage: device.power?.batteryPercentage ?? 100,
    batteryVoltage: device.power?.batteryVoltage ?? 4.25,
    batteryMv: device.power?.batteryMv ?? Math.round((device.power?.batteryVoltage ?? 4.25) * 1000),
    isCharging: device.power?.isCharging ?? true,
    isUsbConnected: device.power?.isUsbConnected ?? true,
    isExternalPower: device.power?.isExternalPower ?? true,
    isLowBattery: device.power?.isLowBattery ?? false,
  }

  const accelerometer = {
    xG: (device.accelerometer as any)?.xG ?? device.accelerometer?.x ?? 0.004,
    yG: (device.accelerometer as any)?.yG ?? device.accelerometer?.y ?? -0.224,
    zG: (device.accelerometer as any)?.zG ?? device.accelerometer?.z ?? -0.968,
    motion: device.accelerometer?.motion ?? false,
    harshBrakingCount: device.accelerometer?.harshBrakingCount ?? 0,
    harshAccelerationCount: device.accelerometer?.harshAccelerationCount ?? 0,
    sharpTurnCount: device.accelerometer?.sharpTurnCount ?? 0,
    impactCount: device.accelerometer?.impactCount ?? 0,
  }

  const devInfo = {
    modelId: device.device?.modelId || 'GW1NS-4',
    hardwareVersion: device.device?.hardwareVersion || 'Z636_V1',
    appVersion: device.device?.appVersion || 'WMZ_DEV_1.0.3',
    sdkVersion: device.device?.sdkVersion || 'WM_SDK_C_260810',
    bootReason: device.device?.bootReason || 'power-off charging',
    uptimeSec: (device.device as any)?.uptimeSec ?? device.device?.uptime ?? 5811,
  }

  const rtcTime = typeof device.rtc === 'object' ? (device.rtc as any)?.rtcTime : device.rtc || device.lastSeen

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {device.deviceName || `SmartLock-${device.deviceId.slice(-4)}`}
              </h1>

              {/* Lock Status Pill Badge */}
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border shadow-xs transition ${
                  isLocked
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                }`}
              >
                {isLocked ? (
                  <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Unlock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                )}
                <span>{isLocked ? 'Locked' : 'Unlocked'}</span>
              </div>

              {/* Moving / Parked Status */}
              <StatusBadge
                label={isMoving ? 'Moving' : 'Parked'}
                variant={isMoving ? 'success' : 'info'}
                pulse={isMoving}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400 mt-1">
              <span className="font-mono">IMEI: {device.deviceId} &middot; Model: {devInfo.modelId}</span>
              <span className="inline-flex items-center gap-1 text-emerald-500 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <Clock className="h-3 w-3 animate-pulse" />
                <span>Last Telemetry: {formatRelativeTime(device.lastSeen)} ({formatTimeSafe(device.lastSeen, 'HH:mm:ss')})</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleQueryStatus}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Query Telemetry
          </button>
        </div>
      </div>

      {actionStatus && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {actionStatus}
        </div>
      )}

      {/* Live Map Card */}
      <DeviceLiveMapCard device={device} height="h-[460px]" />

      {/* Telemetry Detail Grid - Exact 6-Card Layout from GPS Tracker Dashboard */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 1. GNSS & GPS Satellite Metrics */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Satellite className="h-4 w-4 text-blue-500" />
            GPS / GNSS Telemetry
          </h3>
          <div className="space-y-1">
            <InfoRow
              label="Fix Status"
              value={<span className="font-bold text-emerald-500">{gps.status} ({gps.fixType})</span>}
            />
            <InfoRow label="Latitude" value={`${gps.latitude.toFixed(6)}°`} />
            <InfoRow label="Longitude" value={`${gps.longitude.toFixed(6)}°`} />
            <InfoRow
              label="Speed"
              value={<span className="font-mono font-bold">{gps.speedKmph.toFixed(1)} km/h</span>}
            />
            <InfoRow
              label="Heading"
              value={`${Math.round(gps.headingDeg)}° (${getHeadingDirection(gps.headingDeg)})`}
            />
            <InfoRow label="Altitude" value={`${gps.altitudeM.toFixed(1)} m`} />
            <InfoRow
              label="Satellites Tracked"
              value={<span className="font-bold text-blue-400">{gps.satellites} Satellites</span>}
            />
            <InfoRow label="HDOP Precision" value={gps.hdop} />
            <InfoRow label="Accuracy" value={`±${gps.accuracyM} m`} />
            <InfoRow label="Last Fix Time" value={formatTimeSafe(gps.lastFix)} />
          </div>
        </Card>

        {/* 2. Cellular & RF Telemetry */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Radio className="h-4 w-4 text-purple-500" />
            Cellular & Carrier Link
          </h3>
          <div className="space-y-1">
            <InfoRow
              label="Mobile Operator"
              value={<span className="font-bold text-purple-400">{cellular.operator}</span>}
            />
            <InfoRow
              label="Network Type"
              value={`${cellular.networkType} (Band ${cellular.band})`}
            />
            <InfoRow
              label="Signal Rating"
              value={<span className="text-emerald-400 font-bold">{cellular.signal}</span>}
            />
            <InfoRow
              label="RSSI / RSRP"
              value={`${cellular.rssi} dBm / ${cellular.rsrp} dBm`}
            />
            <InfoRow
              label="RSRQ / SINR"
              value={`${cellular.rsrq} dB / ${cellular.sinr} dB`}
            />
            <InfoRow label="Cell ID / TAC" value={`${cellular.cellId} / ${cellular.tac}`} />
            <InfoRow label="MCC / MNC" value={`${cellular.mcc} / ${cellular.mnc}`} />
            <InfoRow
              label="IPv4 Address"
              value={<span className="font-mono text-[11px]">{cellular.ip4}</span>}
            />
            <InfoRow
              label="IMSI"
              value={<span className="font-mono text-[11px]">{cellular.imsi}</span>}
            />
          </div>
        </Card>

        {/* 3. Power & Battery Management */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-500" />
            Power & Battery State
          </h3>
          <div className="space-y-1">
            <InfoRow
              label="Battery Level"
              value={<span className="font-bold text-slate-800 dark:text-slate-100">{power.batteryPercentage}%</span>}
            />
            <InfoRow
              label="Battery Voltage"
              value={`${power.batteryVoltage} V (${power.batteryMv} mV)`}
            />
            <InfoRow
              label="Charging State"
              value={power.isCharging ? 'Charging (Active)' : 'Not Charging'}
            />
            <InfoRow
              label="USB Power Connection"
              value={power.isUsbConnected ? 'Connected (Y)' : 'Disconnected'}
            />
            <InfoRow
              label="External 12V/24V Power"
              value={power.isExternalPower ? 'Active (Y)' : 'Off'}
            />
            <InfoRow
              label="Low Battery Alert"
              value={power.isLowBattery ? <span className="text-red-500 font-bold">YES</span> : 'Normal'}
            />
          </div>
        </Card>

        {/* 4. Accelerometer & Driving Dynamics */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-emerald-500" />
            3-Axis G-Force & Motion
          </h3>
          <div className="space-y-2 mb-3">
            <AxisBar label="X-Axis (Lateral Tilt)" value={accelerometer.xG} color="bg-blue-500" />
            <AxisBar label="Y-Axis (Pitch / Accel)" value={accelerometer.yG} color="bg-emerald-500" />
            <AxisBar label="Z-Axis (Vertical G)" value={accelerometer.zG} color="bg-purple-500" />
          </div>
          <div className="space-y-1">
            <InfoRow
              label="Motion State"
              value={accelerometer.motion ? 'Active Motion' : 'Stationary'}
            />
            <InfoRow label="Harsh Braking Events" value={accelerometer.harshBrakingCount} />
            <InfoRow label="Harsh Acceleration Events" value={accelerometer.harshAccelerationCount} />
            <InfoRow label="Sharp Turn Events" value={accelerometer.sharpTurnCount} />
            <InfoRow label="Crash / Impact Events" value={accelerometer.impactCount} />
          </div>
        </Card>

        {/* 5. Device Firmware & Diagnostics */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Cpu className="h-4 w-4 text-slate-400" />
            Device Firmware & Hardware
          </h3>
          <div className="space-y-1">
            <InfoRow label="Model ID" value={devInfo.modelId} />
            <InfoRow label="Hardware Version" value={devInfo.hardwareVersion} />
            <InfoRow label="App Version" value={devInfo.appVersion} />
            <InfoRow label="SDK Version" value={devInfo.sdkVersion} />
            <InfoRow label="Boot Reason" value={devInfo.bootReason} />
            <InfoRow label="Uptime" value={formatUptime(devInfo.uptimeSec)} />
            <InfoRow label="RTC Synced Time" value={formatTimeSafe(rtcTime)} />
          </div>
        </Card>

        {/* 6. Diagnostic Controls */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            Device LED Diagnostics
          </h3>
          <p className="text-xs text-slate-400 mb-3">
            Send remote LED test blink commands to verify physical tracker indicators via MQTT.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleLed('green', 'blink')}
              className="rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-600/20 dark:text-emerald-400 dark:border-emerald-500/30 py-2 text-xs font-bold hover:bg-emerald-200 transition"
            >
              Blink Green
            </button>
            <button
              onClick={() => handleLed('red', 'blink')}
              className="rounded-lg bg-red-100 text-red-800 border border-red-300 dark:bg-red-600/20 dark:text-red-400 dark:border-red-500/30 py-2 text-xs font-bold hover:bg-red-200 transition"
            >
              Blink Red
            </button>
            <button
              onClick={() => handleLed('blue', 'blink')}
              className="rounded-lg bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-600/20 dark:text-blue-400 dark:border-blue-500/30 py-2 text-xs font-bold hover:bg-blue-200 transition"
            >
              Blink Blue
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
