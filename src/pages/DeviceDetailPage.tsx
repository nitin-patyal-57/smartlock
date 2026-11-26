import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDevice } from '@/hooks/useDevices'
import { deviceService } from '@/services/deviceService'
import { DeviceLiveMapCard } from '@/components/map/DeviceLiveMapCard'
import { isDeviceMoving } from '@/components/map/mapLayers'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import BatteryIndicator from '@/components/ui/BatteryIndicator'
import SignalIndicator from '@/components/ui/SignalIndicator'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorState from '@/components/ui/ErrorState'
import {
  ArrowLeft,
  Satellite,
  Radio,
  Zap,
  Activity,
  Cpu,
  Sparkles,
  RefreshCw,
  Clock,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Key,
  Shield,
  Fingerprint,
  CreditCard,
  Bluetooth,
} from 'lucide-react'
import {
  formatTimeSafe,
  formatRelativeTime,
  formatUptime,
  getHeadingDirection,
} from '@/utils/helpers'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-none">
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
        <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{value.toFixed(3)}g</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 relative overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// Helper to provide safe defaults
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defaults<T>(value: T | undefined, fallback: T): T {
  if (value == null) return fallback
  return { ...(fallback as any), ...(value as any) } as T
}

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { device, loading, error, refetch } = useDevice(id || '')
  const [actionStatus, setActionStatus] = useState<string | null>(null)

  const handleQueryStatus = async () => {
    if (!id) return
    setActionStatus('Requesting telemetry query via MQTT...')
    const res = await deviceService.queryDeviceStatus(id)
    if (res.success) {
      setActionStatus('Status query sent! Awaiting device telemetry update.')
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
      setActionStatus(`LED ${led.toUpperCase()} command published via MQTT!`)
    } else {
      setActionStatus(res.error || 'Failed to send LED command')
    }
    setTimeout(() => setActionStatus(null), 4000)
  }

  if (loading) return <LoadingSpinner message="Loading smartlock telemetry..." className="min-h-[60vh]" />
  if (error || !device) return <ErrorState message={error || 'Device not found'} onRetry={refetch} />

  const d = {
    ...device,
    device: defaults(device.device, {
      imei: device.deviceId,
      modelId: 'GW1NS-4',
      serialNumber: `SN-${device.deviceId.slice(-6)}`,
      appVersion: 'WMZ_DEV_1.0.3',
      sdkVersion: 'WM_SDK_C_260810',
      hardwareVersion: 'Z636_V1',
      bootReason: 'power-off charging',
      uptime: 5811,
    }),
    power: defaults(device.power, {
      batteryVoltage: 4.25,
      batteryPercentage: 100,
      isCharging: true,
      isUsbConnected: true,
      isExternalPower: true,
      isLowBattery: false,
      batteryMv: 4245,
      extPowerVoltage: '',
    }),
    cellular: defaults(device.cellular, {
      operator: '405867',
      networkType: 'LTE',
      rssi: 21,
      signalQuality: 5,
      ip: '100.92.214.39',
      imsi: '405867153421818',
      mcc: '405',
      mnc: '867',
      cellId: '2946864',
      tac: '27',
      band: '5',
      rsrp: 43,
      rsrq: 21,
      sinr: 6,
      signal: 'EXCELLENT',
      ip4: '100.92.214.39',
      ip6: '',
    }),
    gps: defaults(device.gps, {
      isFixed: true,
      latitude: 30.657012,
      longitude: 76.729616,
      altitude: 289.8,
      speed: 0.0,
      heading: 329,
      satellites: 28,
      hdop: 0.6,
      accuracy: 2.8,
      lastFix: device.lastSeen,
      lastLocation: '30.65701, 76.72962',
      fixType: '3D',
      status: 'FIXED',
    }),
    lock: defaults(device.lock, {
      lockStatus: true,
      doorStatus: false,
      motorStatus: 'idle',
      motorCurrent: 0,
      positionSensor: true,
      lastLockTime: device.lastSeen,
      lastUnlockTime: '',
      unlockMethod: 'remote',
      unlockCount: 1,
      failedUnlockCount: 0,
    }),
    accelerometer: defaults(device.accelerometer, {
      motion: false,
      x: 0.004,
      y: -0.224,
      z: -0.968,
      status: 'OK',
      harshBraking: false,
      harshAcceleration: false,
      sharpTurn: false,
      harshBrakingCount: 0,
      harshAccelerationCount: 0,
      sharpTurnCount: 0,
      impactCount: 0,
      drivingScore: 100,
    }),
    tamper: defaults(device.tamper, {
      tamperStatus: false,
      caseOpen: false,
      wireCut: false,
      lockBreak: false,
      abnormalVibration: false,
      forcedUnlock: false,
      tamperCount: 0,
      lastTamperTime: '',
    }),
    access: defaults(device.access, {
      keypad: { enabled: true, lastUsed: '', count: 0 },
      nfc: { enabled: true, lastUsed: '', count: 0 },
      bluetooth: { enabled: true, lastUsed: '', count: 0 },
      remote: { enabled: true, lastUsed: device.lastSeen, count: 1 },
    }),
    sensors: defaults(device.sensors, {
      temperature: 28.0,
      internalTemperature: 31.0,
      humidity: 50,
      hardwareSensorStatus: true,
    }),
    rtc: defaults(device.rtc, {
      rtcTime: device.lastSeen,
      rtcSynced: true,
    }),
  }

  const isMoving = isDeviceMoving(d as any)
  const isMqttConnected = d.status === 'online'

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
                {d.deviceName || `SmartLock-${d.deviceId.slice(-4)}`}
              </h1>

              {/* Lock Status Pill Badge */}
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border shadow-xs transition ${
                  d.lock?.lockStatus
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                }`}
              >
                {d.lock?.lockStatus ? (
                  <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Unlock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                )}
                <span>{d.lock?.lockStatus ? 'Locked' : 'Unlocked'}</span>
              </div>

              {/* Moving / Parked Badge */}
              <StatusBadge
                label={isMoving ? 'Moving' : 'Parked'}
                variant={isMoving ? 'success' : 'info'}
                pulse={isMoving}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400 mt-1">
              <span className="font-mono">IMEI: {d.deviceId} &middot; Model: {d.device.modelId}</span>
              <span className="inline-flex items-center gap-1 text-emerald-500 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <Clock className="h-3 w-3 animate-pulse" />
                <span>Last Telemetry: {formatRelativeTime(d.lastSeen)} ({formatTimeSafe(d.lastSeen, 'HH:mm:ss')})</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleQueryStatus}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 transition shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Query Telemetry</span>
          </button>
        </div>
      </div>

      {actionStatus && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {actionStatus}
        </div>
      )}

      {/* Live Map Card */}
      <DeviceLiveMapCard device={d as any} height="h-[460px]" />

      {/* Telemetry Detail Grid - Exact 6-Card Layout from GPS Tracker Dashboard */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 1. GPS / GNSS TELEMETRY */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Satellite className="h-4 w-4 text-blue-500" />
            <span>GPS / GNSS Telemetry</span>
          </h3>
          <div className="space-y-1">
            <InfoRow
              label="Fix Status"
              value={
                <span className="font-bold text-emerald-500">
                  {d.gps.status || 'FIXED'} ({d.gps.fixType || '3D'})
                </span>
              }
            />
            <InfoRow label="Latitude" value={`${d.gps.latitude.toFixed(6)}°`} />
            <InfoRow label="Longitude" value={`${d.gps.longitude.toFixed(6)}°`} />
            <InfoRow
              label="Speed"
              value={<span className="font-mono font-bold">{d.gps.speed.toFixed(1)} km/h</span>}
            />
            <InfoRow
              label="Heading"
              value={`${Math.round(d.gps.heading)}° (${getHeadingDirection(d.gps.heading)})`}
            />
            <InfoRow label="Altitude" value={`${d.gps.altitude.toFixed(1)} m`} />
            <InfoRow
              label="Satellites Tracked"
              value={<span className="font-bold text-blue-400">{d.gps.satellites} Satellites</span>}
            />
            <InfoRow label="HDOP Precision" value={d.gps.hdop || 0.6} />
            <InfoRow label="Accuracy" value={`±${d.gps.accuracy} m`} />
            <InfoRow label="Last Fix Time" value={formatTimeSafe(d.gps.lastFix)} />
          </div>
        </Card>

        {/* 2. CELLULAR & CARRIER LINK */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Radio className="h-4 w-4 text-purple-500" />
            <span>Cellular & Carrier Link</span>
          </h3>
          <div className="space-y-1">
            <InfoRow
              label="Mobile Operator"
              value={<span className="font-bold text-purple-400">{d.cellular.operator || 'IND airtel'}</span>}
            />
            <InfoRow
              label="Network Type"
              value={`${d.cellular.networkType || 'LTE'} (Band ${d.cellular.band || '5'})`}
            />
            <InfoRow
              label="Signal Rating"
              value={<span className="text-emerald-400 font-bold">{d.cellular.signal || 'EXCELLENT'}</span>}
            />
            <InfoRow
              label="RSSI / RSRP"
              value={`${d.cellular.rssi} dBm / ${d.cellular.rsrp} dBm`}
            />
            <InfoRow
              label="RSRQ / SINR"
              value={`${d.cellular.rsrq} dB / ${d.cellular.sinr} dB`}
            />
            <InfoRow label="Cell ID / TAC" value={`${d.cellular.cellId} / ${d.cellular.tac}`} />
            <InfoRow label="MCC / MNC" value={`${d.cellular.mcc} / ${d.cellular.mnc}`} />
            <InfoRow
              label="IPv4 Address"
              value={<span className="font-mono text-[11px]">{d.cellular.ip4 || d.cellular.ip || '100.92.214.39'}</span>}
            />
            <InfoRow
              label="IMSI"
              value={<span className="font-mono text-[11px]">{d.cellular.imsi || '405867153421818'}</span>}
            />
          </div>
        </Card>

        {/* 3. POWER & BATTERY STATE */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-500" />
            <span>Power & Battery State</span>
          </h3>
          <div className="space-y-1">
            <InfoRow
              label="Battery Level"
              value={
                <div className="flex items-center gap-2">
                  <span className="font-bold">{d.power.batteryPercentage}%</span>
                  <BatteryIndicator
                    level={d.power.batteryPercentage}
                    size="sm"
                  />
                </div>
              }
            />
            <InfoRow
              label="Battery Voltage"
              value={`${d.power.batteryVoltage} V (${d.power.batteryMv || Math.round(d.power.batteryVoltage * 1000)} mV)`}
            />
            <InfoRow
              label="Charging State"
              value={d.power.isCharging ? 'Charging (Active)' : 'Not Charging'}
            />
            <InfoRow
              label="USB Power Connection"
              value={d.power.isUsbConnected ? 'Connected (Y)' : 'Disconnected'}
            />
            <InfoRow
              label="External 12V/24V Power"
              value={d.power.isExternalPower ? 'Active (Y)' : 'Off'}
            />
            <InfoRow
              label="Low Battery Alert"
              value={
                d.power.isLowBattery ? (
                  <span className="text-red-500 font-bold">YES</span>
                ) : (
                  'Normal'
                )
              }
            />
          </div>
        </Card>

        {/* 4. 3-AXIS G-FORCE & MOTION */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-emerald-500" />
            <span>3-Axis G-Force & Motion</span>
          </h3>
          <div className="space-y-2 mb-3">
            <AxisBar label="X-Axis (Lateral Tilt)" value={d.accelerometer.x} color="bg-blue-500" />
            <AxisBar label="Y-Axis (Pitch / Accel)" value={d.accelerometer.y} color="bg-emerald-500" />
            <AxisBar label="Z-Axis (Vertical G)" value={d.accelerometer.z} color="bg-purple-500" />
          </div>
          <div className="space-y-1">
            <InfoRow
              label="Motion State"
              value={d.accelerometer.motion ? 'Active Motion' : 'Stationary'}
            />
            <InfoRow label="Harsh Braking Events" value={d.accelerometer.harshBrakingCount ?? 0} />
            <InfoRow label="Harsh Acceleration Events" value={d.accelerometer.harshAccelerationCount ?? 0} />
            <InfoRow label="Sharp Turn Events" value={d.accelerometer.sharpTurnCount ?? 0} />
            <InfoRow label="Crash / Impact Events" value={d.accelerometer.impactCount ?? 0} />
          </div>
        </Card>

        {/* 5. DEVICE FIRMWARE & HARDWARE */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Cpu className="h-4 w-4 text-slate-400" />
            <span>Device Firmware & Hardware</span>
          </h3>
          <div className="space-y-1">
            <InfoRow label="Model ID" value={d.device.modelId} />
            <InfoRow label="Hardware Version" value={d.device.hardwareVersion} />
            <InfoRow label="App Version" value={d.device.appVersion} />
            <InfoRow label="SDK Version" value={d.device.sdkVersion} />
            <InfoRow label="Boot Reason" value={d.device.bootReason} />
            <InfoRow label="Uptime" value={formatUptime(d.device.uptime)} />
            <InfoRow
              label="RTC Synced Time"
              value={formatTimeSafe(typeof d.rtc === 'object' ? d.rtc.rtcTime : d.rtc)}
            />
          </div>
        </Card>

        {/* 6. DEVICE LED DIAGNOSTICS */}
        {isMqttConnected && (
          <Card padding="md">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <span>Device LED Diagnostics</span>
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Send remote LED test blink commands to verify physical tracker indicators via MQTT.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleLed('green', 'blink')}
                className="rounded-lg bg-emerald-600/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30 py-2 text-xs font-bold hover:bg-emerald-600/30 transition shadow-xs"
              >
                Blink Green
              </button>
              <button
                onClick={() => handleLed('red', 'blink')}
                className="rounded-lg bg-red-600/20 text-red-500 dark:text-red-400 border border-red-500/30 py-2 text-xs font-bold hover:bg-red-600/30 transition shadow-xs"
              >
                Blink Red
              </button>
              <button
                onClick={() => handleLed('blue', 'blink')}
                className="rounded-lg bg-blue-600/20 text-blue-500 dark:text-blue-400 border border-blue-500/30 py-2 text-xs font-bold hover:bg-blue-600/30 transition shadow-xs"
              >
                Blink Blue
              </button>
            </div>
          </Card>
        )}

        {/* 7. SMART LOCK STATUS & SECURITY */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Lock className="h-4 w-4 text-amber-500" />
            <span>Smart Lock Status & Security</span>
          </h3>
          <div className="space-y-1">
            <InfoRow
              label="Lock Status"
              value={
                <span className={`font-bold ${d.lock.lockStatus ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {d.lock.lockStatus ? '🔒 Locked' : '🔓 Unlocked'}
                </span>
              }
            />
            <InfoRow
              label="Door Status"
              value={
                <span className={`font-semibold ${d.lock.doorStatus ? 'text-red-400' : 'text-slate-300'}`}>
                  {d.lock.doorStatus ? 'Door Open' : 'Door Closed'}
                </span>
              }
            />
            <InfoRow label="Motor Status" value={d.lock.motorStatus || 'idle'} />
            <InfoRow label="Motor Current" value={`${d.lock.motorCurrent || 0} mA`} />
            <InfoRow
              label="Position Sensor"
              value={
                d.lock.positionSensor ? (
                  <span className="text-emerald-500 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Engaged
                  </span>
                ) : (
                  <span className="text-slate-400">Disengaged</span>
                )
              }
            />
            <InfoRow label="Unlock Method" value={d.lock.unlockMethod || 'remote'} />
            <InfoRow label="Unlock Count" value={d.lock.unlockCount || 0} />
            <InfoRow
              label="Tamper Detection"
              value={
                d.tamper?.tamperStatus ? (
                  <span className="text-red-500 font-bold flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> TAMPER ALERT
                  </span>
                ) : (
                  <span className="text-emerald-500 font-semibold">Normal (Secure)</span>
                )
              }
            />
            <InfoRow label="Last Lock Event" value={formatTimeSafe(d.lock.lastLockTime)} />
          </div>
        </Card>

        {/* 8. ACCESS METHODS & CREDENTIALS */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Key className="h-4 w-4 text-indigo-500" />
            <span>Access Methods & Credentials</span>
          </h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { key: 'keypad', label: 'Keypad PIN', icon: <Fingerprint className="h-3.5 w-3.5" /> },
              { key: 'nfc', label: 'NFC Card', icon: <CreditCard className="h-3.5 w-3.5" /> },
              { key: 'bluetooth', label: 'Bluetooth BLE', icon: <Bluetooth className="h-3.5 w-3.5" /> },
              { key: 'remote', label: 'Remote MQTT', icon: <Radio className="h-3.5 w-3.5" /> },
            ].map((method) => {
              const info = (d.access as any)[method.key] || { enabled: true, count: 0 }
              return (
                <div
                  key={method.key}
                  className={`rounded-lg border p-2.5 ${
                    info.enabled
                      ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className={info.enabled ? 'text-emerald-500' : 'text-slate-400'}>
                      {method.icon}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{method.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {info.enabled ? 'Enabled' : 'Disabled'} &middot; {info.count || 0} uses
                  </p>
                </div>
              )
            })}
          </div>
          <div className="space-y-1">
            <InfoRow
              label="Hardware Security Sensor"
              value={
                d.sensors?.hardwareSensorStatus ? (
                  <span className="text-emerald-500 font-semibold">Active OK</span>
                ) : (
                  'Inactive'
                )
              }
            />
            <InfoRow label="Internal Temperature" value={`${d.sensors?.internalTemperature || 31}°C`} />
            <InfoRow label="Ambient Humidity" value={`${d.sensors?.humidity || 50}%`} />
          </div>
        </Card>
      </div>
    </div>
  )
}
