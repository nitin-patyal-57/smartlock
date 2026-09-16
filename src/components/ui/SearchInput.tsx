import { cn } from '@/utils/helpers'
import { Search } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm',
          'text-slate-900 placeholder-slate-400',
          'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
          'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500',
          'dark:focus:border-primary-400 dark:focus:ring-primary-400'
        )}
      />
    </div>
  )
}
