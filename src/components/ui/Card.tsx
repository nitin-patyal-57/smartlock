import React from 'react'
import { cn } from '@/utils/helpers'

interface CardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
}

const paddingStyles: Record<string, string> = {
  none: '',
  sm: 'p-3 sm:p-4',
  md: 'p-4 sm:p-5 lg:p-6',
  lg: 'p-5 sm:p-6 lg:p-8',
}

export default React.memo(function Card({ children, className, hover = false, padding = 'md', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl border border-slate-200/90 bg-white shadow-xs',
        'dark:border-slate-800/90 dark:bg-[#0d1629] dark:shadow-md dark:shadow-black/25',
        hover && 'transition-all duration-200 hover:border-emerald-500/50 hover:shadow-xl hover:shadow-black/25 hover:-translate-y-0.5 cursor-pointer',
        paddingStyles[padding],
        className
      )}
    >
      {children}
    </div>
  )
})
