import { cn } from '@/utils/helpers'
import { AlertTriangle } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className="mb-4 rounded-full bg-red-100 p-3 dark:bg-red-900/30">
        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
      </div>
      <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            'mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white',
            'transition-colors hover:bg-primary-700',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
            'dark:bg-primary-500 dark:hover:bg-primary-600'
          )}
        >
          Try Again
        </button>
      )}
    </div>
  )
}
