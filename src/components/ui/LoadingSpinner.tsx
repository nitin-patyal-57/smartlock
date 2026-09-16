import { cn } from '@/utils/helpers'

interface LoadingSpinnerProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles: Record<string, string> = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
}

export default function LoadingSpinner({ message, size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-2 border-slate-200 border-t-primary-600',
          'dark:border-slate-700 dark:border-t-primary-400',
          sizeStyles[size]
        )}
      />
      {message && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
      )}
    </div>
  )
}
