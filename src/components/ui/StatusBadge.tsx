import React from 'react'
import { cn } from '@/utils/helpers'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

interface StatusBadgeProps {
  label: string
  variant: BadgeVariant
  size?: 'sm' | 'md'
  pulse?: boolean
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-300 border border-emerald-500/40 shadow-xs shadow-emerald-500/20 font-bold',
  warning: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300 border border-amber-500/40 shadow-xs shadow-amber-500/20 font-bold',
  danger: 'bg-rose-500/15 text-rose-700 dark:bg-rose-500/25 dark:text-rose-300 border border-rose-500/40 shadow-xs shadow-rose-500/20 font-bold',
  info: 'bg-sky-500/15 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300 border border-sky-500/40 shadow-xs shadow-sky-500/20 font-bold',
  neutral: 'bg-slate-200/90 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold',
}

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

export default React.memo(function StatusBadge({ label, variant, size = 'sm', pulse = false }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        variantStyles[variant],
        sizeStyles[size]
      )}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              variant === 'success' && 'bg-emerald-400',
              variant === 'warning' && 'bg-amber-400',
              variant === 'danger' && 'bg-red-400',
              variant === 'info' && 'bg-blue-400',
              variant === 'neutral' && 'bg-slate-400'
            )}
          />
          <span
            className={cn(
              'relative inline-flex h-2 w-2 rounded-full',
              variant === 'success' && 'bg-emerald-500',
              variant === 'warning' && 'bg-amber-500',
              variant === 'danger' && 'bg-red-500',
              variant === 'info' && 'bg-blue-500',
              variant === 'neutral' && 'bg-slate-500'
            )}
          />
        </span>
      )}
      {label}
    </span>
  )
})
