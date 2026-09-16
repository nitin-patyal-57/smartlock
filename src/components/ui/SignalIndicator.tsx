import { cn } from '@/utils/helpers'

interface SignalIndicatorProps {
  rssi: number
  signalQuality: number
  size?: 'sm' | 'md'
  className?: string
}

export default function SignalIndicator({ rssi, size = 'md', className }: SignalIndicatorProps) {
  const getBarCount = () => {
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
    <div className={cn('inline-flex items-end gap-[2px]', className)}>
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
              : 'bg-slate-200 dark:bg-slate-600',
            heights[size][i]
          )}
        />
      ))}
    </div>
  )
}
