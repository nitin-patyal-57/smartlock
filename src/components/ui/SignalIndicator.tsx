import React from 'react'
import { cn } from '@/utils/helpers'

interface SignalIndicatorProps {
  rssi: number
  signalQuality?: number
  signalText?: string
  size?: 'sm' | 'md'
  showText?: boolean
  className?: string
}

export default React.memo(function SignalIndicator({
  rssi,
  signalQuality = 4,
  signalText,
  size = 'md',
  showText = false,
  className,
}: SignalIndicatorProps) {
  const isOffline = signalText === 'OFFLINE' || signalQuality === 0 || rssi <= -100

  const getBarCount = () => {
    if (isOffline) return 0
    if (rssi > -50) return 4
    if (rssi > -70) return 3
    if (rssi > -85) return 2
    return 1
  }

  const barCount = getBarCount()

  const heights = {
    sm: ['h-1.5', 'h-2', 'h-2.5', 'h-3'],
    md: ['h-2', 'h-3', 'h-4', 'h-5'],
  }

  const barWidth = size === 'sm' ? 'w-[3px]' : 'w-[4px]'

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <div className="flex items-end gap-[2px]">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              barWidth,
              'rounded-full transition-colors duration-200',
              i < barCount
                ? barCount >= 3
                  ? 'bg-emerald-500'
                  : barCount === 2
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                : 'bg-slate-300 dark:bg-slate-700',
              heights[size][i]
            )}
          />
        ))}
      </div>
      {showText && (
        <span
          className={cn(
            'text-xs font-bold uppercase tracking-wider',
            isOffline
              ? 'text-rose-600 dark:text-rose-400'
              : barCount >= 3
                ? 'text-emerald-600 dark:text-[#38bdf8]'
                : barCount === 2
                  ? 'text-amber-500'
                  : 'text-rose-500'
          )}
        >
          {signalText || `${signalQuality}/5`}
        </span>
      )}
    </div>
  )
})
