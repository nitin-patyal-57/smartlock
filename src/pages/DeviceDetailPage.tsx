import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDevice } from '@/hooks/useDevices'
import { deviceService } from '@/services/deviceService'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import BatteryIndicator from '@/components/ui/BatteryIndicator'
import SignalIndicator from '@/components/ui/SignalIndicator'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorState from '@/components/ui/ErrorState'
import { format } from 'date-fns'
import {
  ArrowLeft, Battery, Lock, Unlock, MapPin, Wifi,
  Shield, HardDrive, Activity, Gauge,
  Navigation, Route, Circle, Thermometer, Clock,
  AlertTriangle, Key, CreditCard, Bluetooth, Radio,
  Fingerprint, Cpu, CheckCircle2, XCircle, Info,
  Zap, Sliders, RefreshCw, Power
} from 'lucide-react'

function formatDateSafe(val: string | undefined | null, pattern: string, fallback = 'N/A'): string {
  if (!val) return fallback
  const d = new Date(val)
  if (isNaN(d.getTime())) return fallback
  try {
    return format(d, pattern)
  } catch {
    return fallback
  }
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card padding="md">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
        {icon}
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </Card>
  )
}

function InfoRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between ${className || ''}`}>
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  )
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function AxisBar({ value, min, max }: { value: number; min: number; max: number }) {
  const range = max - min
  const pct = range > 0 ? ((value - min) / range) * 100 : 50
  const color = Math.abs(value) > 1 ? 'bg-red-500' : Math.abs(value) > 0.5 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="relative h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
      <div className="absolute left-1/2 top-0 h-full w-px bg-slate-400 dark:bg-slate-500" />
      <div
        className={`absolute top-0 h-full w-2 -translate-x-1/2 rounded-full ${color}`}
        style={{ left: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

function ScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? 'stroke-emerald-500' : score >= 50 ? 'stroke-amber-500' : 'stroke-red-500'

  return (
    <div className="flex items-center gap-4">
      <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" strokeWidth="6" className="stroke-slate-200 dark:stroke-slate-700" />
        <circle
          cx="40" cy="40" r="36" fill="none" strokeWidth="6"
          className={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div>
        <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{score}</p>
        <p className="text-xs text-slate-500">Driving Score</p>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function defaults<T>(value: T | undefined, fallback: T): T {
  if (value == null) return fallback
  return { ...fallback as any, ...value as any } as T
}

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { device, loading, error, refetch } = useDevice(id || '')
  const [actionStatus, setActionStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [isActionPending, setIsActionPending] = useState(false)

  const handleRelay = async (relay: 1 | 2, state: 'on' | 'off') => {
    if (!id) return
    setIsActionPending(true)
    setActionStatus({ message: `Publishing Relay ${relay} -> ${state.toUpperCase()} via MQTT...`, type: 'success' })
    try {
      const res = await deviceService.sendRelayCommand(id, relay, state)
      if (res.success) {
        setActionStatus({ message: `Relay ${relay} set to ${state.toUpperCase()}! Waiting for device ack.`, type: 'success' })
      } else {
        setActionStatus({ message: res.error || 'Failed to send relay command', type: 'error' })
      }
    } catch {
      setActionStatus({ message: 'Error sending relay command', type: 'error' })
    } finally {
      setIsActionPending(false)
      setTimeout(() => setActionStatus(null), 5000)
    }
  }

  const handleLed = async (led: 'red' | 'green' | 'blue', state: 'auto' | 'blink' | 'on' | 'off') => {
    if (!id) return
    setIsActionPending(true)
    setActionStatus({ message: `Publishing ${led.toUpperCase()} LED -> ${state.toUpperCase()} via MQTT...`, type: 'success' })
    try {
      const res = await deviceService.sendLedCommand(id, led, state)
      if (res.success) {
        setActionStatus({ message: `${led.toUpperCase()} LED set to ${state.toUpperCase()}!`, type: 'success' })
      } else {
        setActionStatus({ message: res.error || 'Failed to send LED command', type: 'error' })
      }
    } catch {
      setActionStatus({ message: 'Error sending LED command', type: 'error' })
    } finally {
      setIsActionPending(false)
      setTimeout(() => setActionStatus(null), 5000)
    }
  }

  const handleQueryStatus = async () => {
    if (!id) return
    setIsActionPending(true)
    setActionStatus({ message: 'Requesting live status from device via MQTT...', type: 'success' })
    try {
      const res = await deviceService.queryDeviceStatus(id)
      if (res.success) {
        setActionStatus({ message: 'Status query sent to device!', type: 'success' })
      } else {
        setActionStatus({ message: res.error || 'Failed to request status', type: 'error' })
      }
    } catch {
      setActionStatus({ message: 'Error requesting status', type: 'error' })
    } finally {
      setIsActionPending(false)
      setTimeout(() => setActionStatus(null), 5000)
    }
  }

  if (loading) return <LoadingSpinner message="Loading device details..." className="min-h-[60vh]" />
  if (error) return <ErrorState message={error} onRetry={refetch} />
  if (!device) return <ErrorState title="Device not found" message={`No device found with ID: ${id}`} />

  const d = {
    ...device,
    device: defaults(device.device, { imei: '', modelId: '', serialNumber: '', appVersion: '', sdkVersion: '', hardwareVersion: '', bootReason: '', uptime: 0 }),
    power: defaults(device.power, { batteryVoltage: 0, batteryPercentage: 0, isCharging: false, isUsbConnected: false, isExternalPower: false, isLowBattery: false }),
    cellular: defaults(device.cellular, { operator: '', networkType: '', rssi: 0, signalQuality: 0, ip: '' }),
    gps: defaults(device.gps, { isFixed: false, latitude: 0, longitude: 0, altitude: 0, speed: 0, heading: 0, satellites: 0, hdop: 0, accuracy: 0, lastFix: '', lastLocation: '' }),
    lock: defaults(device.lock, { lockStatus: false, doorStatus: false, motorStatus: '', motorCurrent: 0, positionSensor: false, lastLockTime: '', lastUnlockTime: '', unlockMethod: '', unlockCount: 0, failedUnlockCount: 0 }),
    access: defaults(device.access, { keypad: { enabled: false, lastUsed: '', count: 0 }, nfc: { enabled: false, lastUsed: '', count: 0 }, bluetooth: { enabled: false, lastUsed: '', count: 0 }, remote: { enabled: false, lastUsed: '', count: 0 } }),
    tamper: defaults(device.tamper, { tamperStatus: false, caseOpen: false, wireCut: false, lockBreak: false, abnormalVibration: false, forcedUnlock: false, tamperCount: 0, lastTamperTime: '' }),
    accelerometer: defaults(device.accelerometer, { motion: false, x: 0, y: 0, z: 0, harshBraking: false, harshAcceleration: false, sharpTurn: false, impactCount: 0, drivingScore: 0 }),
    trip: defaults(device.trip, { vehicleStatus: 'stationary', tripStatus: false, tripId: '', distance: 0, maximumSpeed: 0, overspeedCount: 0 }),
    geofence: defaults(device.geofence, { status: 'inside', geofenceId: '', violation: false, lastEvent: '' }),
    sensors: defaults(device.sensors, { temperature: 0, internalTemperature: 0, humidity: 0, hardwareSensorStatus: false }),
    security: defaults(device.security, { deviceBinding: false, vehicleId: '', customerId: '', certificateStatus: false, secureBoot: false, firmwareSignature: false }),
    memory: defaults(device.memory, { totalStorage: 0, usedStorage: 0, freeStorage: 0 }),
    diagnostics: defaults(device.diagnostics, { lastDiagnosticTime: '', errorCodes: [], systemHealth: 'good' }),
    rtc: defaults(device.rtc, { rtcTime: '', rtcSynced: false }),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {d.deviceName || d.deviceId}
          </h1>
          <p className="font-mono text-sm text-slate-500 dark:text-slate-400">{d.deviceId}</p>
        </div>
        <div className="ml-auto">
          <StatusBadge
            label={d.status}
            variant={d.status === 'online' ? 'success' : d.status === 'offline' ? 'danger' : 'warning'}
            size="md"
            pulse={d.status === 'online'}
          />
        </div>
      </div>

      {d.lastSeen === 'No telemetry data received yet' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                Device Registered (IMEI: {d.deviceId}) &mdash; Awaiting First Telemetry Transmission
              </p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                This smart lock is configured in your dashboard. The Walnut Medical server is awaiting initial data packets from this hardware. Once the device powers on with active cellular service, all live telemetry (battery, GPS location, lock sensors, cellular signal) will update here in real-time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hardware Controls (WEGW Relays & LEDs) */}
      <Card padding="md" className="border-indigo-100 bg-gradient-to-r from-slate-50 to-indigo-50/30 dark:border-indigo-900/40 dark:from-slate-900 dark:to-indigo-950/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-600 p-2 text-white shadow">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Hardware Controls (WEGW MQTT Downlink)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sends QoS 1 commands to <code className="font-mono text-indigo-600 dark:text-indigo-400">soundbox_dev/{d.deviceId}/command</code>
              </p>
            </div>
          </div>
          <button
            onClick={handleQueryStatus}
            disabled={isActionPending}
            className="flex items-center gap-1.5 self-start rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isActionPending ? 'animate-spin' : ''}`} />
            Query Device Status
          </button>
        </div>

        {actionStatus && (
          <div className={`mt-3 rounded-md px-3 py-2 text-xs font-medium ${actionStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'}`}>
            {actionStatus.message}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Relay 1 */}
          <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-800/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Relay 1 (Ignition / Lock)</span>
              <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${d.relays?.['1'] === 'on' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                {d.relays?.['1'] ? d.relays['1'].toUpperCase() : 'OFF / READY'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleRelay(1, 'on')}
                disabled={isActionPending}
                className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                Turn ON
              </button>
              <button
                onClick={() => handleRelay(1, 'off')}
                disabled={isActionPending}
                className="rounded bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                Turn OFF
              </button>
            </div>
          </div>

          {/* Relay 2 */}
          <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-800/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Relay 2 (Accessory / Siren)</span>
              <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${d.relays?.['2'] === 'on' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                {d.relays?.['2'] ? d.relays['2'].toUpperCase() : 'OFF / READY'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleRelay(2, 'on')}
                disabled={isActionPending}
                className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                Turn ON
              </button>
              <button
                onClick={() => handleRelay(2, 'off')}
                disabled={isActionPending}
                className="rounded bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                Turn OFF
              </button>
            </div>
          </div>

          {/* RGB LEDs */}
          <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-xs sm:col-span-2 lg:col-span-1 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Status LEDs</span>
              <span className="text-xs text-slate-400">Blue/Green/Red</span>
            </div>
            <div className="space-y-1.5">
              {(['blue', 'green', 'red'] as const).map(color => (
                <div key={color} className="flex items-center justify-between gap-1 text-xs">
                  <span className="capitalize font-medium text-slate-700 dark:text-slate-300">{color}:</span>
                  <div className="flex gap-1">
                    {(['auto', 'blink', 'on', 'off'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => handleLed(color, mode)}
                        disabled={isActionPending}
                        className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Device Info */}
        <SectionCard title="Device Info" icon={<Cpu className="h-4 w-4 text-blue-500" />}>
          <InfoRow label="IMEI" value={d.device.imei} />
          <InfoRow label="Model" value={d.device.modelId} />
          <InfoRow label="Serial" value={d.device.serialNumber} />
          <InfoRow label="App Version" value={d.device.appVersion} />
          <InfoRow label="SDK Version" value={d.device.sdkVersion} />
          <InfoRow label="HW Version" value={d.device.hardwareVersion} />
          <InfoRow label="Boot Reason" value={d.device.bootReason} />
          <InfoRow label="Uptime" value={`${Math.floor(d.device.uptime / 3600)}h ${Math.floor((d.device.uptime % 3600) / 60)}m`} />
        </SectionCard>

        {/* Battery */}
        <SectionCard title="Battery" icon={<Battery className="h-4 w-4 text-emerald-500" />}>
          <div className="flex items-center gap-4">
            <BatteryIndicator level={d.power.batteryPercentage} size="lg" showLabel />
          </div>
          <InfoRow label="Voltage" value={`${d.power.batteryVoltage}V`} />
          <InfoRow
            label="Charging"
            value={d.power.isCharging ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-slate-300" />}
          />
          <InfoRow
            label="USB Connected"
            value={d.power.isUsbConnected ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-slate-300" />}
          />
          <InfoRow
            label="External Power"
            value={d.power.isExternalPower ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-slate-300" />}
          />
          {d.power.isLowBattery && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-red-700 dark:bg-red-900/20 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Low Battery Warning</span>
            </div>
          )}
        </SectionCard>

        {/* Lock Status */}
        <SectionCard title="Lock Status" icon={<Lock className="h-4 w-4 text-amber-500" />}>
          <div className="flex items-center gap-3">
            {d.lock.lockStatus ? (
              <Lock className="h-10 w-10 text-emerald-500" />
            ) : (
              <Unlock className="h-10 w-10 text-amber-500" />
            )}
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {d.lock.lockStatus ? 'Locked' : 'Unlocked'}
              </p>
              <p className="text-xs text-slate-500">Door is {d.lock.doorStatus ? 'open' : 'closed'}</p>
            </div>
          </div>
          <InfoRow label="Motor Status" value={d.lock.motorStatus} />
          <InfoRow label="Motor Current" value={`${d.lock.motorCurrent}mA`} />
          <InfoRow
            label="Position Sensor"
            value={d.lock.positionSensor ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-slate-300" />}
          />
          <InfoRow label="Last Lock" value={formatDateSafe(d.lock.lastLockTime, 'MMM d, HH:mm')} />
          <InfoRow label="Last Unlock" value={formatDateSafe(d.lock.lastUnlockTime, 'MMM d, HH:mm')} />
          <InfoRow label="Unlock Method" value={d.lock.unlockMethod || 'N/A'} />
          <InfoRow label="Unlocks" value={d.lock.unlockCount} />
          <InfoRow label="Failed Unlocks" value={<span className={d.lock.failedUnlockCount > 0 ? 'text-red-500' : ''}>{d.lock.failedUnlockCount}</span>} />
        </SectionCard>

        {/* Current Location */}
        <SectionCard title="Current Location" icon={<MapPin className="h-4 w-4 text-rose-500" />}>
          {d.gps.latitude !== 0 && d.gps.longitude !== 0 ? (
            <div className="h-40 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <iframe
                title="Device Location"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${d.gps.longitude - 0.01},${d.gps.latitude - 0.005},${d.gps.longitude + 0.01},${d.gps.latitude + 0.005}&layer=mapnik&marker=${d.gps.latitude},${d.gps.longitude}`}
              />
            </div>
          ) : (
            <div className="flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 p-4 text-center">
              <MapPin className="h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No GPS Coordinates</p>
              <p className="text-xs text-slate-400">Waiting for device satellite acquisition</p>
            </div>
          )}
          <InfoRow label="Latitude" value={d.gps.latitude ? d.gps.latitude.toFixed(6) : '0.000000'} />
          <InfoRow label="Longitude" value={d.gps.longitude ? d.gps.longitude.toFixed(6) : '0.000000'} />
          <InfoRow label="Altitude" value={`${d.gps.altitude}m`} />
          <InfoRow label="Speed" value={`${d.gps.speed} km/h`} />
        </SectionCard>

        {/* GPS */}
        <SectionCard title="GPS" icon={<Navigation className="h-4 w-4 text-violet-500" />}>
          <InfoRow
            label="Fixed"
            value={d.gps.isFixed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
          />
          <InfoRow label="Satellites" value={d.gps.satellites} />
          <InfoRow label="HDOP" value={d.gps.hdop} />
          <InfoRow label="Accuracy" value={`${d.gps.accuracy}m`} />
          <InfoRow label="Last Fix" value={formatDateSafe(d.gps.lastFix, 'MMM d, HH:mm:ss')} />
        </SectionCard>

        {/* Cellular */}
        <SectionCard title="Cellular" icon={<Wifi className="h-4 w-4 text-cyan-500" />}>
          <InfoRow label="Operator" value={d.cellular.operator} />
          <InfoRow label="Network" value={d.cellular.networkType} />
          <InfoRow label="RSSI" value={`${d.cellular.rssi} dBm`} />
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Signal</span>
            <SignalIndicator rssi={d.cellular.rssi} signalQuality={d.cellular.signalQuality} size="md" />
          </div>
          <InfoRow label="Quality" value={`${d.cellular.signalQuality}/5`} />
          <InfoRow label="IP Address" value={d.cellular.ip} />
        </SectionCard>

        {/* Access Methods */}
        <SectionCard title="Access Methods" icon={<Key className="h-4 w-4 text-indigo-500" />}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'keypad', label: 'Keypad', icon: <Fingerprint className="h-4 w-4" /> },
              { key: 'nfc', label: 'NFC', icon: <CreditCard className="h-4 w-4" /> },
              { key: 'bluetooth', label: 'Bluetooth', icon: <Bluetooth className="h-4 w-4" /> },
              { key: 'remote', label: 'Remote', icon: <Radio className="h-4 w-4" /> },
            ].map((method) => {
              const info = d.access[method.key as keyof typeof d.access]
              return (
                <div
                  key={method.key}
                  className={`rounded-lg border p-3 ${
                    info.enabled
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className={info.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                      {method.icon}
                    </span>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{method.label}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {info.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                  {info.lastUsed && (
                    <p className="text-xs text-slate-400">
                      Used {formatDateSafe(info.lastUsed, 'MMM d')}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">{info.count} uses</p>
                </div>
              )
            })}
          </div>
        </SectionCard>

        {/* Security / Tamper */}
        <SectionCard title="Security & Tamper" icon={<Shield className="h-4 w-4 text-red-500" />}>
          {d.tamper.tamperStatus && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-red-700 dark:bg-red-900/20 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">Tamper Alert Active</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Case Open', value: d.tamper.caseOpen },
              { label: 'Wire Cut', value: d.tamper.wireCut },
              { label: 'Lock Break', value: d.tamper.lockBreak },
              { label: 'Vibration', value: d.tamper.abnormalVibration },
              { label: 'Forced Unlock', value: d.tamper.forcedUnlock },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                {item.value ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                )}
                <span className="text-xs text-slate-600 dark:text-slate-300">{item.label}</span>
              </div>
            ))}
          </div>
          <InfoRow label="Tamper Count" value={d.tamper.tamperCount} />
          <InfoRow
            label="Last Tamper"
            value={formatDateSafe(d.tamper.lastTamperTime, 'MMM d, HH:mm')}
          />
        </SectionCard>

        {/* Accelerometer */}
        <SectionCard title="Accelerometer" icon={<Gauge className="h-4 w-4 text-orange-500" />}>
          <InfoRow
            label="Motion"
            value={d.accelerometer.motion ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-slate-300" />}
          />
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs text-slate-500"><span>X</span><span>{d.accelerometer.x.toFixed(2)}g</span></div>
              <AxisBar value={d.accelerometer.x} min={-2} max={2} />
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-500"><span>Y</span><span>{d.accelerometer.y.toFixed(2)}g</span></div>
              <AxisBar value={d.accelerometer.y} min={-2} max={2} />
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-500"><span>Z</span><span>{d.accelerometer.z.toFixed(2)}g</span></div>
              <AxisBar value={d.accelerometer.z} min={-2} max={2} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <InfoRow label="Harsh Brake" value={d.accelerometer.harshBraking ? '⚠️' : '—'} />
            <InfoRow label="Harsh Accel" value={d.accelerometer.harshAcceleration ? '⚠️' : '—'} />
            <InfoRow label="Sharp Turn" value={d.accelerometer.sharpTurn ? '⚠️' : '—'} />
          </div>
          <InfoRow label="Impact Count" value={d.accelerometer.impactCount} />
          <ScoreRing score={d.accelerometer.drivingScore} />
        </SectionCard>

        {/* Trip */}
        <SectionCard title="Trip" icon={<Route className="h-4 w-4 text-teal-500" />}>
          <InfoRow label="Vehicle Status" value={d.trip.vehicleStatus} />
          <InfoRow
            label="Trip Active"
            value={d.trip.tripStatus ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-slate-300" />}
          />
          <InfoRow label="Trip ID" value={d.trip.tripId || 'N/A'} />
          <InfoRow label="Distance" value={`${d.trip.distance.toFixed(1)} km`} />
          <InfoRow label="Max Speed" value={`${d.trip.maximumSpeed} km/h`} />
          <InfoRow
            label="Overspeed"
            value={<span className={d.trip.overspeedCount > 0 ? 'text-red-500 font-medium' : ''}>{d.trip.overspeedCount}</span>}
          />
        </SectionCard>

        {/* Geofence */}
        <SectionCard title="Geofence" icon={<Circle className="h-4 w-4 text-pink-500" />}>
          <InfoRow
            label="Status"
            value={
              <StatusBadge
                label={d.geofence.status}
                variant={
                  d.geofence.status === 'inside' ? 'success'
                    : d.geofence.status === 'outside' ? 'danger'
                    : 'warning'
                }
              />
            }
          />
          <InfoRow label="Geofence ID" value={d.geofence.geofenceId || 'N/A'} />
          <InfoRow
            label="Violation"
            value={d.geofence.violation ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          />
          <InfoRow label="Last Event" value={d.geofence.lastEvent || 'N/A'} />
        </SectionCard>

        {/* Sensors */}
        <SectionCard title="Sensors" icon={<Thermometer className="h-4 w-4 text-yellow-500" />}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Temperature</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-red-400"
                  style={{ width: `${Math.min(100, ((d.sensors.temperature + 20) / 60) * 100)}%` }}
                />
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{d.sensors.temperature}°C</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Internal Temp</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-red-400"
                  style={{ width: `${Math.min(100, ((d.sensors.internalTemperature + 20) / 60) * 100)}%` }}
                />
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{d.sensors.internalTemperature}°C</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Humidity</span>
            <div className="flex items-center gap-2">
              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-400"
                  style={{ width: `${d.sensors.humidity}%` }}
                />
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{d.sensors.humidity}%</span>
            </div>
          </div>
          <InfoRow
            label="HW Sensor"
            value={d.sensors.hardwareSensorStatus ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-slate-300" />}
          />
        </SectionCard>

        {/* Security Info */}
        <SectionCard title="Security Info" icon={<Shield className="h-4 w-4 text-indigo-500" />}>
          <InfoRow label="Vehicle ID" value={d.security.vehicleId || 'N/A'} />
          <InfoRow label="Customer ID" value={d.security.customerId || 'N/A'} />
          <InfoRow
            label="Device Binding"
            value={d.security.deviceBinding ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
          />
          <InfoRow
            label="Certificate"
            value={d.security.certificateStatus ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
          />
          <InfoRow
            label="Secure Boot"
            value={d.security.secureBoot ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
          />
          <InfoRow
            label="FW Signature"
            value={d.security.firmwareSignature ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
          />
        </SectionCard>

        {/* Memory / Storage */}
        <SectionCard title="Memory & Storage" icon={<HardDrive className="h-4 w-4 text-slate-500" />}>
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Used: {(d.memory.usedStorage / 1024).toFixed(1)} MB</span>
              <span>Total: {(d.memory.totalStorage / 1024).toFixed(1)} MB</span>
            </div>
            <ProgressBar
              value={d.memory.usedStorage}
              max={d.memory.totalStorage}
              color="bg-gradient-to-r from-primary-400 to-primary-600"
            />
            <p className="mt-1 text-xs text-slate-400">Free: {(d.memory.freeStorage / 1024).toFixed(1)} MB</p>
          </div>
        </SectionCard>

        {/* Diagnostics */}
        <SectionCard title="Diagnostics" icon={<Activity className="h-4 w-4 text-cyan-500" />}>
          <InfoRow
            label="Health"
            value={
              <StatusBadge
                label={d.diagnostics.systemHealth}
                variant={
                  d.diagnostics.systemHealth === 'healthy' ? 'success'
                    : d.diagnostics.systemHealth === 'degraded' ? 'warning'
                    : 'danger'
                }
              />
            }
          />
          <InfoRow
            label="Last Diagnostic"
            value={formatDateSafe(d.diagnostics.lastDiagnosticTime, 'MMM d, HH:mm')}
          />
          {d.diagnostics.errorCodes?.length > 0 ? (
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Error Codes</span>
              <div className="flex flex-wrap gap-1">
                {d.diagnostics.errorCodes.map((code) => (
                  <span
                    key={code}
                    className="rounded bg-red-100 px-2 py-0.5 text-xs font-mono text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">No error codes</p>
          )}
        </SectionCard>

        {/* RTC */}
        <SectionCard title="RTC" icon={<Clock className="h-4 w-4 text-slate-400" />}>
          <InfoRow
            label="RTC Time"
            value={formatDateSafe(d.rtc.rtcTime, 'MMM d, HH:mm:ss')}
          />
          <InfoRow
            label="Synced"
            value={d.rtc.rtcSynced ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
          />
        </SectionCard>
      </div>
    </div>
  )
}