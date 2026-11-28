import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDevice } from '@/hooks/useDevices'
import { deviceService } from '@/services/deviceService'
import { DeviceLiveMapCard } from '@/components/map/DeviceLiveMapCard'
import { isDeviceMoving } from '@/components/map/mapLayers'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import BatteryIndicator from '@/components/ui/BatteryIndicator'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ErrorState from '@/components/ui/ErrorState'
import {
  ArrowLeft,
  Satellite,
  Radio,
  Zap,
  Cpu,
  RefreshCw,
  Clock,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Key,
  Eye,
  EyeOff,
  X,
  Loader2,
} from 'lucide-react'
import {
  formatTimeSafe,
  formatRelativeTime,
  formatUptime,
  getHeadingDirection,
  isDeviceOnline,
} from '@/utils/helpers'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs py-2 border-b border-slate-200/80 dark:border-slate-800/80 last:border-none">
      <span className="text-slate-500 dark:text-slate-400 font-bold tracking-wide text-[11px] uppercase">{label}</span>
      <span className="font-bold text-slate-900 dark:text-white text-xs">{value}</span>
    </div>
  )
}

function AxisBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, ((value + 2) / 4) * 100))
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="font-mono text-slate-400 font-bold">{label}:</span>
        <span className="font-mono font-black text-slate-900 dark:text-white">{value.toFixed(3)}g</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700/80 relative overflow-hidden">
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
  const [isPinModalOpen, setIsPinModalOpen] = useState(false)
  const [targetAction, setTargetAction] = useState<'UNLOCK' | 'LOCK'>('UNLOCK')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [submittingPin, setSubmittingPin] = useState(false)
  const [pinFeedback, setPinFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [optimisticLockStatus, setOptimisticLockStatus] = useState<boolean | null>(null)

  const handleOpenPinModal = (action: 'UNLOCK' | 'LOCK') => {
    setTargetAction(action)
    setPin('')
    setShowPin(false)
    setPinFeedback(null)
    setIsPinModalOpen(true)
  }

  const handleSubmitLockCommand = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin.trim()) {
      setPinFeedback({ type: 'error', message: 'Please enter the security PIN or password.' })
      return
    }

    setSubmittingPin(true)
    setPinFeedback(null)

    const targetId = id || device?.deviceId || ''
    const res = await deviceService.sendLockControl(targetId, targetAction, pin.trim())

    if (res.success) {
      const isUnlock = targetAction === 'UNLOCK'
      setOptimisticLockStatus(!isUnlock)
      setPinFeedback({
        type: 'success',
        message: `PIN verified! Command ${targetAction} confirmed by MQTT broker. Smart lock is now ${isUnlock ? 'UNLOCKED' : 'LOCKED'}.`
      })
      setTimeout(() => {
        setIsPinModalOpen(false)
        setSubmittingPin(false)
        setPin('')
        setPinFeedback(null)
      }, 1500)
    } else {
      const reasonStr = res.reason === 'WRONG_PIN'
        ? 'Wrong PIN! The smart lock rejected the entered password (WRONG_PIN).'
        : (res.error || 'Lock command failed or timed out.')
      setPinFeedback({
        type: 'error',
        message: reasonStr
      })
      setSubmittingPin(false)
    }
  }

  const handleQueryStatus = async () => {
    setActionStatus('Requesting telemetry query via MQTT...')
    const targetId = id || device?.deviceId || ''
    const res = await deviceService.queryDeviceStatus(targetId)
    if (res.success) {
      setActionStatus('Status query sent! Telemetry refreshed.')
    } else {
      setActionStatus(res.error || 'Failed to send query')
    }
    setTimeout(() => setActionStatus(null), 4000)
  }

  if (loading) return <LoadingSpinner message="Loading smartlock telemetry..." className="min-h-[60vh]" />
  if (!device) return <ErrorState message={error || 'SmartLock device not found or has been removed from the dashboard.'} onRetry={refetch} />

  const base = device
  const activeDev = device

  const d = {
    ...base,
    ...(activeDev || {}),
    deviceId: activeDev?.deviceId || base.deviceId,
    deviceName: activeDev?.deviceName || base.deviceName,
    device: {
      ...base.device,
      ...(activeDev?.device || {})
    },
    power: {
      ...base.power,
      ...(activeDev?.power || {})
    },
    cellular: {
      ...base.cellular,
      ...(activeDev?.cellular || {})
    },
    gps: {
      ...base.gps,
      ...(activeDev?.gps || {})
    },
    lock: {
      ...base.lock,
      ...(activeDev?.lock || {})
    },
    accelerometer: {
      ...base.accelerometer,
      ...(activeDev?.accelerometer || {})
    },
    tamper: {
      ...base.tamper,
      ...(activeDev?.tamper || {})
    },
    access: {
      ...base.access,
      ...(activeDev?.access || {})
    },
    rtc: {
      ...base.rtc,
      ...(typeof activeDev?.rtc === 'object' ? activeDev.rtc : {})
    }
  }

  // Apply optimistic lock status if recently updated via remote control
  if (optimisticLockStatus !== null) {
    if (!d.lock) (d as any).lock = {}
    d.lock.lockStatus = optimisticLockStatus
    d.lock.lockStatusStr = optimisticLockStatus ? 'LOCKED' : 'UNLOCKED'
  }

  // Authentic online/offline determination
  const isOnline = isDeviceOnline(d as any)
  const isMoving = isOnline && isDeviceMoving(d as any)

  // When offline, guarantee telemetry numbers in d are zeroed / offline
  if (!isOnline) {
    if (d.gps) {
      d.gps.speed = 0
    }
    if (d.accelerometer) {
      d.accelerometer.motion = false
    }
    d.status = 'offline'
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/locks')}
            className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black font-mono text-slate-900 dark:text-slate-100 tracking-tight">
                {Boolean(d.deviceName && !d.deviceName.toLowerCase().startsWith('smartlock-') && d.deviceName !== d.deviceId)
                  ? d.deviceName
                  : `IMEI: ${d.deviceId}`}
              </h1>

              {/* Lock Status Pill Badge */}
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold border shadow-xs transition ${
                  !isOnline
                    ? 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20'
                    : d.lock?.lockStatus
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                }`}
              >
                {isOnline ? (
                  d.lock?.lockStatus ? (
                    <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  )
                ) : (
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                )}
                <span>
                  {isOnline ? (d.lock?.lockStatus ? 'Locked' : 'Unlocked') : 'N/A (Device Offline)'}
                </span>
              </div>

              {/* Status Badge: Moving / Parked / Offline */}
              <StatusBadge
                label={isOnline ? (isMoving ? 'Moving' : 'Parked') : 'Offline'}
                variant={isOnline ? (isMoving ? 'success' : 'info') : 'danger'}
                pulse={isOnline && isMoving}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-400 mt-1">
              <span className="font-mono">IMEI: {d.deviceId} &middot; Model: {d.device.modelId}</span>
              <span
                className={`inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full border ${
                  isOnline
                    ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-slate-500 bg-slate-500/10 border-slate-500/20'
                }`}
              >
                <Clock className={`h-3 w-3 ${isOnline ? 'animate-pulse' : ''}`} />
                <span>
                  {isOnline
                    ? `Live Telemetry: ${formatRelativeTime(d.lastSeen)} (${formatTimeSafe(d.lastSeen, 'HH:mm:ss')})`
                    : d.lastSeen
                    ? `Device Offline (Last seen: ${formatRelativeTime(d.lastSeen)})`
                    : 'Device Offline (No telemetry received)'}
                </span>
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

      {/* Remote Smart Lock Security Control Card */}
      <Card
        padding="lg"
        className={`border-2 shadow-xl transition-all duration-300 ${
          d.lock?.lockStatus
            ? 'border-emerald-500/50 bg-gradient-to-r from-emerald-50 via-white to-white dark:from-emerald-500/15 dark:via-[#0d1629] dark:to-[#0d1629] shadow-emerald-500/10'
            : 'border-amber-500/50 bg-gradient-to-r from-amber-50 via-white to-white dark:from-amber-500/15 dark:via-[#0d1629] dark:to-[#0d1629] shadow-amber-500/10'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div
              className={`p-4 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                d.lock?.lockStatus
                  ? 'bg-emerald-500/25 text-emerald-400 border border-emerald-500/50 shadow-emerald-500/20'
                  : 'bg-amber-500/25 text-amber-400 border border-amber-500/50 shadow-amber-500/20'
              }`}
            >
              {d.lock?.lockStatus ? (
                <Lock className="h-8 w-8" />
              ) : (
                <Unlock className="h-8 w-8" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Remote Smart Lock Control
                </h3>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black tracking-wide uppercase border shadow-sm ${
                    d.lock?.lockStatus
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40 shadow-emerald-500/20'
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40 shadow-amber-500/20'
                  }`}
                >
                  {d.lock?.lockStatus ? '● CURRENTLY LOCKED' : '○ CURRENTLY UNLOCKED'}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-300 mt-1.5 max-w-xl">
                {d.lock?.lockStatus
                  ? 'The smart lock is currently securely LOCKED. Click "Unlock Device" below to enter the PIN password and verify via MQTT.'
                  : 'The smart lock is currently UNLOCKED. Click "Lock Device" below to secure the lock and engage the latch via MQTT.'}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-2.5 text-xs text-slate-400 font-semibold">
                <span className="flex items-center gap-1.5 font-bold">
                  Door Status:{' '}
                  <strong className={`px-2 py-0.5 rounded-md ${d.lock?.doorStatus ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'}`}>
                    {d.lock?.doorStatus ? 'OPEN' : 'CLOSED'}
                  </strong>
                </span>
                {d.lock?.lastUnlockTime && (
                  <span className="flex items-center gap-1">
                    Last Unlocked:{' '}
                    <strong className="text-slate-200">{formatTimeSafe(d.lock.lastUnlockTime)}</strong> ({d.lock.lastUnlockMethod || 'REMOTE'})
                  </span>
                )}
                {Boolean(d.lock?.failedUnlockCount) && (
                  <span className="text-rose-400 font-extrabold flex items-center gap-1">
                    Failed Attempts: {d.lock.failedUnlockCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {d.lock?.lockStatus ? (
              <button
                type="button"
                onClick={() => handleOpenPinModal('UNLOCK')}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-slate-950 font-black px-7 py-3.5 text-sm shadow-xl shadow-amber-500/30 transition cursor-pointer"
              >
                <Unlock className="h-4 w-4" />
                <span>Unlock Device</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenPinModal('LOCK')}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-95 text-white font-black px-7 py-3.5 text-sm shadow-xl shadow-emerald-500/30 transition cursor-pointer"
              >
                <Lock className="h-4 w-4" />
                <span>Lock Device</span>
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Exact 6-Card Telemetry Grid Matching User Specification */}
      {/* When device is OFF, every section displays N/A (no demo data) */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 1. DEVICE INFORMATION */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Cpu className="h-4 w-4 text-slate-500" />
            <span>Device Information</span>
          </h3>
          <div className="space-y-1">
            <InfoRow label="IMEI" value={<span className="font-mono text-xs">{d.device.imei || d.deviceId}</span>} />
            <InfoRow label="Model ID" value={<span className="font-bold text-slate-900 dark:text-slate-100">{d.device.modelId || 'GW1NS-4'}</span>} />
            <InfoRow label="Serial Number" value={isOnline && d.device.serialNumber ? d.device.serialNumber : 'N/A'} />
            <InfoRow label="App Version" value={isOnline && d.device.appVersion ? d.device.appVersion : 'N/A'} />
            <InfoRow label="SDK Version" value={isOnline && d.device.sdkVersion ? d.device.sdkVersion : 'N/A'} />
            <InfoRow label="Hardware Version" value={isOnline && d.device.hardwareVersion ? d.device.hardwareVersion : 'N/A'} />
            <InfoRow label="Boot Reason" value={isOnline && d.device.bootReason ? d.device.bootReason : 'N/A'} />
            <InfoRow label="Uptime" value={isOnline && d.device.uptime ? formatUptime(d.device.uptime) : 'N/A'} />
          </div>
        </Card>

        {/* 2. POWER & BATTERY STATE */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-500" />
            <span>Power & Battery State</span>
          </h3>
          <div className="space-y-1">
            <InfoRow
              label="Battery Level"
              value={
                isOnline && (d.power?.batteryPercentage ?? 0) > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{d.power.batteryPercentage}%</span>
                    <BatteryIndicator level={d.power.batteryPercentage} size="sm" />
                  </div>
                ) : (
                  <span className="text-slate-400 font-mono">N/A</span>
                )
              }
            />
            <InfoRow
              label="Battery Voltage"
              value={
                isOnline && (d.power?.batteryVoltage ?? 0) > 0
                  ? `${d.power.batteryVoltage} V (${d.power.batteryMv || Math.round(d.power.batteryVoltage * 1000)} mV)`
                  : 'N/A'
              }
            />
            <InfoRow
              label="Charging State"
              value={
                isOnline && d.power?.charging
                  ? d.power.isCharging ? 'Charging (Active)' : 'Not Charging'
                  : 'N/A'
              }
            />
            <InfoRow
              label="USB Connected"
              value={
                isOnline && d.power?.usb
                  ? d.power.isUsbConnected ? 'Connected (Y)' : 'Disconnected (N)'
                  : 'N/A'
              }
            />
            <InfoRow
              label="External Power"
              value={
                isOnline && d.power?.extPower
                  ? d.power.isExternalPower ? 'Active (Y)' : 'Inactive (N)'
                  : 'N/A'
              }
            />
            <InfoRow label="Ext Power Voltage" value={isOnline && d.power?.extPowerVoltage ? d.power.extPowerVoltage : 'N/A'} />
            <InfoRow
              label="Low Battery Alert"
              value={
                isOnline && d.power?.lowBattery
                  ? d.power.isLowBattery ? <span className="text-red-500 font-bold">Alert (Low)</span> : 'Normal'
                  : 'N/A'
              }
            />
          </div>
        </Card>

        {/* 3. SMART LOCK STATUS & SECURITY */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Lock className="h-4 w-4 text-emerald-500" />
            <span>Smart Lock Status & Security</span>
          </h3>
          <div className="space-y-1">
            <InfoRow
              label="Lock Status"
              value={
                isOnline && d.lock?.lockStatusStr ? (
                  <span className={`font-bold ${d.lock.lockStatus ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {d.lock.lockStatus ? '🔒 LOCKED' : '🔓 UNLOCKED'}
                  </span>
                ) : (
                  <span className="text-slate-400 font-mono">N/A</span>
                )
              }
            />
            <InfoRow
              label="Door Status"
              value={
                isOnline && d.lock?.doorStatusStr ? (
                  <span className={`font-semibold ${d.lock.doorStatus ? 'text-red-400' : 'text-slate-300'}`}>
                    {d.lock.doorStatus ? 'OPEN' : 'CLOSED'}
                  </span>
                ) : (
                  <span className="text-slate-400 font-mono">N/A</span>
                )
              }
            />
            <InfoRow
              label="Lock Motor Status"
              value={isOnline && d.lock?.lockMotorStatus ? <span className="font-semibold text-emerald-400">{d.lock.lockMotorStatus}</span> : 'N/A'}
            />
            <InfoRow
              label="Motor Current"
              value={isOnline && d.lock?.motorCurrentMa ? `${d.lock.motorCurrentMa} mA` : 'N/A'}
            />
            <InfoRow
              label="Lock Position Sensor"
              value={
                isOnline && d.lock?.lockPositionSensor ? (
                  <span className="text-emerald-500 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {d.lock.lockPositionSensor}
                  </span>
                ) : (
                  'N/A'
                )
              }
            />
            <InfoRow label="Last Lock Time" value={isOnline && d.lock?.lastLockTime ? formatTimeSafe(d.lock.lastLockTime) : 'N/A'} />
            <InfoRow label="Last Unlock Time" value={isOnline && d.lock?.lastUnlockTime ? formatTimeSafe(d.lock.lastUnlockTime) : 'N/A'} />
            <InfoRow
              label="Last Unlock Method"
              value={isOnline && d.lock?.lastUnlockMethod ? <span className="font-bold text-indigo-400">{d.lock.lastUnlockMethod}</span> : 'N/A'}
            />
            <InfoRow
              label="Unlock Count"
              value={isOnline && d.lock?.unlockCount !== undefined && d.lock?.unlockCount !== null && d.lock?.unlockCount > 0 ? d.lock.unlockCount : 'N/A'}
            />
            <InfoRow
              label="Failed Unlock Count"
              value={
                isOnline && d.lock?.failedUnlockCount !== undefined && d.lock?.failedUnlockCount !== null
                  ? <span className={d.lock.failedUnlockCount > 0 ? 'text-amber-400 font-semibold' : ''}>{d.lock.failedUnlockCount}</span>
                  : 'N/A'
              }
            />
          </div>
        </Card>

        {/* 4. GPS & NAVIGATION TELEMETRY */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Satellite className="h-4 w-4 text-blue-500" />
            <span>GPS & Navigation Telemetry</span>
          </h3>
          <div className="space-y-1">
            <InfoRow
              label="GPS Fix Status"
              value={
                isOnline && d.gps?.status ? (
                  <span className="font-bold text-emerald-500">
                    {d.gps.status} ({d.gps.fixType || '3D'})
                  </span>
                ) : (
                  <span className="text-slate-400 font-mono">N/A</span>
                )
              }
            />
            <InfoRow
              label="Coordinates"
              value={
                isOnline && d.gps?.latitude && d.gps?.longitude ? (
                  <span className="font-mono text-xs">{d.gps.latitude.toFixed(6)}°, {d.gps.longitude.toFixed(6)}°</span>
                ) : (
                  'N/A'
                )
              }
            />
            <InfoRow
              label="Location"
              value={isOnline && d.gps?.lastLocation ? <span className="font-semibold text-blue-400">{d.gps.lastLocation}</span> : 'N/A'}
            />
            <InfoRow
              label="Ground Speed"
              value={isOnline && d.gps?.speed !== undefined ? <span className="font-mono font-bold">{d.gps.speed.toFixed(1)} km/h</span> : 'N/A'}
            />
            <InfoRow
              label="Course / Heading"
              value={
                isOnline && d.gps?.heading !== undefined
                  ? `${Math.round(d.gps.heading)}° (${getHeadingDirection(d.gps.heading)})`
                  : 'N/A'
              }
            />
            <InfoRow label="Altitude" value={isOnline && d.gps?.altitude ? `${d.gps.altitude.toFixed(1)} m` : 'N/A'} />
            <InfoRow
              label="Satellites Tracked"
              value={isOnline && d.gps?.satellites ? <span className="font-bold text-blue-400">{d.gps.satellites} Satellites</span> : 'N/A'}
            />
            <InfoRow label="HDOP Precision" value={isOnline && d.gps?.hdop ? d.gps.hdop : 'N/A'} />
            <InfoRow label="Accuracy" value={isOnline && d.gps?.accuracy ? `±${d.gps.accuracy} m` : 'N/A'} />
            <InfoRow label="Fix Type" value={isOnline && d.gps?.fixType ? d.gps.fixType : 'N/A'} />
            <InfoRow label="Last Fix Time" value={isOnline && d.gps?.lastFix ? formatTimeSafe(d.gps.lastFix) : 'N/A'} />
          </div>
        </Card>

        {/* 5. CELLULAR & CARRIER LINK */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Radio className="h-4 w-4 text-purple-500" />
            <span>Cellular & Carrier Link</span>
          </h3>
          <div className="space-y-1">
            <InfoRow
              label="Mobile Operator"
              value={isOnline && d.cellular?.operator ? <span className="font-bold text-purple-400">{d.cellular.operator}</span> : 'N/A'}
            />
            <InfoRow
              label="Network Type"
              value={isOnline && d.cellular?.networkType ? d.cellular.networkType : 'N/A'}
            />
            <InfoRow
              label="LTE Serving Band"
              value={isOnline && d.cellular?.band ? `Band ${d.cellular.band}` : 'N/A'}
            />
            <InfoRow
              label="Signal Rating"
              value={isOnline && d.cellular?.signal ? <span className="text-emerald-400 font-bold">{d.cellular.signal}</span> : 'N/A'}
            />
            <InfoRow
              label="RSSI / RSRP"
              value={isOnline && d.cellular?.rssi ? `${d.cellular.rssi} dBm / ${d.cellular.rsrp} dBm` : 'N/A'}
            />
            <InfoRow
              label="RSRQ / SINR"
              value={isOnline && d.cellular?.rsrq ? `${d.cellular.rsrq} dB / ${d.cellular.sinr || 0} dB` : 'N/A'}
            />
            <InfoRow label="Cell ID / TAC" value={isOnline && d.cellular?.cellId ? `${d.cellular.cellId} / ${d.cellular.tac}` : 'N/A'} />
            <InfoRow label="MCC / MNC" value={isOnline && d.cellular?.mcc ? `${d.cellular.mcc} / ${d.cellular.mnc}` : 'N/A'} />
            <InfoRow
              label="IPv4 Address"
              value={isOnline && (d.cellular?.ip4 || d.cellular?.ip) ? <span className="font-mono text-[11px]">{d.cellular.ip4 || d.cellular.ip}</span> : 'N/A'}
            />
            {d.cellular?.ip6 && isOnline && (
              <InfoRow
                label="IPv6 Address"
                value={<span className="font-mono text-[10px] break-all">{d.cellular.ip6}</span>}
              />
            )}
            <InfoRow
              label="SIM IMSI"
              value={isOnline && d.cellular?.imsi ? <span className="font-mono text-[11px]">{d.cellular.imsi}</span> : 'N/A'}
            />
          </div>
        </Card>

        {/* 6. ACCESS, KEYPAD & MOTION */}
        <Card padding="md">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-3">
            <Key className="h-4 w-4 text-indigo-500" />
            <span>Access, Keypad & Motion</span>
          </h3>
          <div className="space-y-1 mb-3">
            <InfoRow
              label="Keypad PIN Status"
              value={
                isOnline && (d.access as any)?.keypad?.status ? (
                  <span className="font-semibold text-emerald-400">
                    {(d.access as any).keypad.status} &middot; Enabled
                  </span>
                ) : (
                  'N/A'
                )
              }
            />
            <InfoRow
              label="Keypad Failed Attempts"
              value={isOnline && (d.access as any)?.keypad?.failedAttempts !== undefined ? (d.access as any).keypad.failedAttempts : 'N/A'}
            />
            <InfoRow
              label="Last Keypad Access"
              value={
                isOnline && ((d.access as any)?.keypad?.lastAccess || (d.access as any)?.keypad?.lastUsed)
                  ? formatTimeSafe((d.access as any)?.keypad?.lastAccess || (d.access as any)?.keypad?.lastUsed)
                  : 'N/A'
              }
            />
            <InfoRow
              label="Tamper Status"
              value={
                isOnline ? (
                  d.tamper?.tamperStatus ? (
                    <span className="text-red-500 font-bold flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> TAMPER ALERT
                    </span>
                  ) : (
                    <span className="text-emerald-500 font-semibold">Normal (Secure)</span>
                  )
                ) : (
                  'N/A'
                )
              }
            />
            <InfoRow
              label="Device Motion State"
              value={
                isOnline ? (
                  <span className={`font-bold ${d.accelerometer?.motion ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {d.accelerometer?.motion ? 'Active Motion' : 'Stationary'}
                  </span>
                ) : (
                  'N/A'
                )
              }
            />
          </div>

          {/* 3-Axis Accelerometer Visual Bars */}
          {isOnline && (d.accelerometer?.x !== undefined || d.accelerometer?.y !== undefined || d.accelerometer?.z !== undefined) ? (
            <div className="space-y-2 mb-3 border-t border-slate-100 dark:border-slate-800 pt-2.5">
              <AxisBar label="X-Axis (Tilt)" value={d.accelerometer.x || 0} color="bg-blue-500" />
              <AxisBar label="Y-Axis (Pitch)" value={d.accelerometer.y || 0} color="bg-emerald-500" />
              <AxisBar label="Z-Axis (Vertical G)" value={d.accelerometer.z || 0} color="bg-purple-500" />
            </div>
          ) : (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-2 mb-3">
              <InfoRow label="Accelerometer (3-Axis)" value="N/A" />
            </div>
          )}

          <div className="space-y-1">
            <InfoRow
              label="Driving Score"
              value={
                isOnline && d.accelerometer?.drivingScore ? (
                  <span className="font-bold text-emerald-500">
                    {d.accelerometer.drivingScore} / 100
                  </span>
                ) : (
                  'N/A'
                )
              }
            />
            <InfoRow
              label="Harsh Driving Events"
              value={
                isOnline ? (
                  <span className="text-xs">
                    Braking: {d.accelerometer?.harshBrakingCount ?? 0} &middot; Accel: {d.accelerometer?.harshAccelerationCount ?? 0} &middot; Turns: {d.accelerometer?.sharpTurnCount ?? 0} &middot; Impact: {d.accelerometer?.impactCount ?? 0}
                  </span>
                ) : (
                  'N/A'
                )
              }
            />
            <InfoRow
              label="Real-Time Clock (RTC)"
              value={
                isOnline && (typeof d.rtc === 'object' ? d.rtc?.rtcTime : d.rtc) ? (
                  <span className="font-mono text-[11px] text-slate-300">
                    {formatTimeSafe(typeof d.rtc === 'object' ? d.rtc.rtcTime : d.rtc)}
                  </span>
                ) : (
                  'N/A'
                )
              }
            />
          </div>
        </Card>
      </div>

      {/* PIN Verification Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <button
              onClick={() => {
                if (!submittingPin) {
                  setIsPinModalOpen(false)
                  setPinFeedback(null)
                }
              }}
              disabled={submittingPin}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                  targetAction === 'UNLOCK'
                    ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                }`}
              >
                {targetAction === 'UNLOCK' ? <Unlock className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {targetAction === 'UNLOCK' ? 'Unlock Smart Lock' : 'Lock Smart Lock'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  IMEI: {d.deviceId}
                  {Boolean(d.deviceName && !d.deviceName.toLowerCase().startsWith('smartlock-') && d.deviceName !== d.deviceId) && (
                    <span> &middot; {d.deviceName}</span>
                  )}
                </p>
              </div>
            </div>

            {/* Protocol Specs Banner */}
            <div className="mt-4 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 p-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>MQTT Command Topic:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  soundbox_dev/{d.deviceId}/command
                </span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Command Action:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{targetAction}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Verification ACK:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  soundbox_dev/{d.deviceId}/ack
                </span>
              </div>
            </div>

            {pinFeedback && (
              <div
                className={`mt-4 flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${
                  pinFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                {pinFeedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span>{pinFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleSubmitLockCommand} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Security PIN / Password
                </label>
                <div className="relative">
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter 4-digit PIN (e.g. 1234)"
                    autoFocus
                    disabled={submittingPin}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 pr-10 text-sm font-mono tracking-widest text-slate-900 placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-100 dark:focus:bg-slate-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[11px] text-slate-400">
                    The lock verifies this PIN on the MQTT broker before operating.
                  </span>
                  <button
                    type="button"
                    onClick={() => setPin('1234')}
                    className="text-[11px] font-semibold text-primary-500 hover:text-primary-600 underline"
                  >
                    Use Default PIN (1234)
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPinModalOpen(false)
                    setPinFeedback(null)
                  }}
                  disabled={submittingPin}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPin || !pin.trim()}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition disabled:opacity-50 ${
                    targetAction === 'UNLOCK'
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold'
                  }`}
                >
                  {submittingPin ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Verifying via MQTT...</span>
                    </>
                  ) : (
                    <>
                      {targetAction === 'UNLOCK' ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      <span>Confirm & {targetAction === 'UNLOCK' ? 'Unlock' : 'Lock'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
