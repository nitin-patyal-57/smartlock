import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, ChevronDown, User, Settings, LogOut } from 'lucide-react'
import { cn } from '@/utils/helpers'

interface HeaderProps {
  onMenuClick: () => void
}

const routeTitles: Record<string, string> = {
  '/': 'Overview',
  '/locks': 'Smart Locks',
  '/map': 'Live Map',
  '/history': 'History',
  '/battery-history': 'Battery History',
  '/lock-activity': 'Lock Activity',
  '/alerts': 'Alerts',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

export function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  const pageTitle = routeTitles[location.pathname] || 'Overview'

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700/50">
      <div className="flex items-center justify-between h-16 px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 lg:hidden transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              {pageTitle}
            </h1>
            <p className="hidden md:block text-xs text-slate-500 dark:text-slate-400">
              {formattedDate} &middot; {formattedTime}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center relative">
            <Search className="absolute left-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search devices..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className={cn(
                'w-64 pl-9 pr-4 py-2 rounded-lg text-sm',
                'bg-slate-100 dark:bg-slate-800',
                'border border-transparent focus:border-emerald-500',
                'text-slate-900 dark:text-white placeholder-slate-400',
                'outline-none transition-all duration-200',
                'focus:ring-2 focus:ring-emerald-500/20'
              )}
            />
          </div>

          <button className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900">
              3
            </span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className={cn(
                'flex items-center gap-2 p-1.5 rounded-lg',
                'hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'
              )}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-sm font-semibold">
                A
              </div>
              <ChevronDown className="hidden md:block w-4 h-4 text-slate-400" />
            </button>

            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-48 py-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50">
                  <button
                    onClick={() => {
                      setShowDropdown(false)
                      navigate('/settings')
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <User className="w-4 h-4" />
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      setShowDropdown(false)
                      navigate('/settings')
                    }}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                  <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
                  <button
                    onClick={() => setShowDropdown(false)}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
