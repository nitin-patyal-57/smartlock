import { cn } from '@/utils/helpers'

interface BatteryIndicatorProps {
  level: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

export default function BatteryIndicator({
  level,
  size = 'md',
  showLabel = false,
  className,
}: BatteryIndicatorProps) {
  const getLevelColor = () => {
    if (level > 50) return 'bg-gradient-to-r from-emerald-400 to-emerald-500'
    if (level > 20) return 'bg-gradient-to-r from-amber-400 to-amber-500'
    return 'bg-gradient-to-r from-red-400 to-red-500'
  }

  const getLevelTextColor = () => {
    if (level > 50) return 'text-emerald-600 dark:text-emerald-400'
    if (level > 20) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  const dimensions = {
    sm: { outer: 'w-12 h-5', inner: 'h-2.5 rounded-sm', gap: 'gap-0.5', tip: 'w-1 h-2.5 rounded-r-sm' },
    md: { outer: 'w-16 h-7', inner: 'h-3.5 rounded', gap: 'gap-0.5', tip: 'w-1.5 h-3.5 rounded-r-md' },
    lg: { outer: 'w-20 h-8', inner: 'h-4 rounded', gap: 'gap-1', tip: 'w-2 h-4 rounded-r-lg' },
  }

  const dim = dimensions[size]

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <div className={cn('inline-flex items-center gap-[2px]', dim.outer)}>
        <div
          className={cn(
            'relative flex-1 overflow-hidden rounded-sm border border-slate-300 bg-slate-100',
            'dark:border-slate-600 dark:bg-slate-700'
          )}
        >
          <div
            className={cn('absolute inset-y-0 left-0 transition-all duration-500', getLevelColor(), dim.inner)}
            style={{ width: `${Math.min(100, Math.max(0, level))}%` }}
          />
        </div>
        <div
          className={cn(
            'border border-slate-300 bg-slate-100 dark:border-slate-600 dark:bg-slate-700',
            dim.tip
          )}
        />
      </div>
      {showLabel && (
        <span className={cn('text-sm font-medium tabular-nums', getLevelTextColor())}>{level}%</span>
      )}
    </div>
  )
}
