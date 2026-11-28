import { useState } from 'react'
import { X, Plus, Lock, Cpu, Tag, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { SmartLockDevice } from '@/types/smartlock'

interface AddDeviceModalProps {
  isOpen: boolean
  onClose: () => void
  onDeviceAdded: (device: SmartLockDevice) => void
  addDeviceFn: (params: { imei: string; deviceName?: string; modelId?: string }) => Promise<SmartLockDevice>
}

export default function AddDeviceModal({
  isOpen,
  onClose,
  onDeviceAdded,
  addDeviceFn,
}: AddDeviceModalProps) {
  const [imei, setImei] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [modelId, setModelId] = useState('GW1NS-4')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanImei = imei.trim()
    if (!cleanImei) {
      setError('Please enter a valid IMEI number.')
      return
    }

    if (cleanImei.length < 10) {
      setError('IMEI must be at least 10 numeric characters (typically 15 digits).')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const dev = await addDeviceFn({
        imei: cleanImei,
        deviceName: deviceName.trim() || undefined,
        modelId: modelId.trim() || undefined,
      })

      setSuccess(true)
      setTimeout(() => {
        setLoading(false)
        setSuccess(false)
        setImei('')
        setDeviceName('')
        onDeviceAdded(dev)
        onClose()
      }, 700)
    } catch (err: any) {
      setError(err.message || 'Failed to register smart lock. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Register New Smart Lock
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Add any IMEI to monitor live GPS, lock status, motion & cellular diagnostics
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Smart Lock registered successfully!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Device IMEI Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Cpu className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                maxLength={20}
                value={imei}
                onChange={(e) => setImei(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 861185084122685"
                className="w-full font-mono rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-emerald-400 dark:focus:bg-slate-800"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              15-digit unique cellular hardware identifier printed on the device.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Lock / Vehicle Label (Optional)
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. Warehouse Main Gate / Smart Lock #02"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-emerald-400 dark:focus:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Hardware Model ID (Optional)
            </label>
            <input
              type="text"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="e.g. GW1NS-4"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-4 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-emerald-400 dark:focus:bg-slate-800"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              <Plus className="h-4 w-4" />
              <span>{loading ? 'Registering...' : 'Register Lock'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
