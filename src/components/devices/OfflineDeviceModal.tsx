import { X, WifiOff, AlertTriangle, Radio, ShieldAlert } from 'lucide-react'
import type { SmartLockDevice } from '@/types/smartlock'
import { formatTimeSafe } from '@/utils/helpers'

interface OfflineDeviceModalProps {
  device: SmartLockDevice | null
  onClose: () => void
}

export default function OfflineDeviceModal({ device, onClose }: OfflineDeviceModalProps) {
  if (!device) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white dark:border-rose-500/30 dark:bg-[#0d1629] p-6 md:p-7 shadow-2xl dark:shadow-rose-950/50 text-slate-900 dark:text-slate-100 ring-1 ring-slate-900/5 dark:ring-rose-500/20">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header with Glowing Offline Icon */}
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-400 shadow-sm">
            <WifiOff className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Device is Offline</span>
            </h2>
            <p className="text-xs text-rose-600 dark:text-rose-400 font-bold tracking-wide">
              Overview & Remote Controls Unavailable
            </p>
          </div>
        </div>

        {/* Device Information Card */}
        <div className="mt-5 rounded-2xl bg-slate-50 dark:bg-[#070b14] border border-slate-200 dark:border-slate-800 p-4 space-y-2.5">
          {Boolean(
            device.deviceName &&
            !device.deviceName.toLowerCase().startsWith('smartlock-') &&
            device.deviceName !== device.deviceId
          ) && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Device Name:</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                {device.deviceName}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">IMEI Number:</span>
            <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {device.deviceId}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Connection Status:</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Offline
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Last Telemetry:</span>
            <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
              {device.lastSeen ? formatTimeSafe(device.lastSeen, 'yyyy-MM-dd HH:mm:ss') : 'Never connected'}
            </span>
          </div>
        </div>

        {/* Notice Box */}
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-200/90 p-3.5 text-xs font-medium leading-relaxed">
          <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <p>
            This smart lock is not transmitting live MQTT data. Full device overview, remote lock/unlock controls, and GPS tracking will activate automatically when the hardware powers on and connects to the cellular network.
          </p>
        </div>

        {/* MQTT Topic Info */}
        <div className="mt-3 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-between px-1">
          <span>Awaiting topic:</span>
          <span className="text-slate-700 dark:text-slate-300 font-bold truncate max-w-[230px]">
            soundbox_dev/{device.deviceId}/metrics
          </span>
        </div>

        {/* Action Button */}
        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white font-bold text-xs shadow-md border border-slate-800 dark:border-slate-700 transition cursor-pointer"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  )
}
