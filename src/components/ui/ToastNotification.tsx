import { useEffect } from 'react'
import { WifiOff, X } from 'lucide-react'

interface ToastNotificationProps {
  message: string
  submessage?: string
  isOpen: boolean
  onClose: () => void
  duration?: number
}

export default function ToastNotification({
  message,
  submessage,
  isOpen,
  onClose,
  duration = 4000,
}: ToastNotificationProps) {
  useEffect(() => {
    if (!isOpen) return
    const timer = setTimeout(() => {
      onClose()
    }, duration)
    return () => clearTimeout(timer)
  }, [isOpen, duration, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed top-5 right-5 z-50 max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#0d1629] border border-rose-500/40 shadow-2xl shadow-black/80 text-white ring-1 ring-rose-500/20">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
          <WifiOff className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <p className="text-xs font-bold text-rose-300">{message}</p>
          {submessage && (
            <p className="mt-0.5 text-[11px] text-slate-400 font-medium leading-relaxed">
              {submessage}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
