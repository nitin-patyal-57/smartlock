import React, { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, ChevronDown, User, Settings, LogOut, AlertTriangle, AlertCircle, Info, CheckCheck } from 'lucide-react'
import { cn } from '@/utils/helpers'
import { useAlerts } from '@/hooks/useDevices'
import { formatDistanceToNow } from 'date-fns'

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

export const Header = React.memo(function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { alerts, acknowledgeAllAlerts } = useAlerts()
  const [searchValue, setSearchValue] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => new Date())

  const unacknowledgedAlerts = useMemo(
    () => alerts.filter(a => !a.acknowledged).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [alerts]
  )
  const unacknowledgedCount = unacknowledgedAlerts.length

  const pageTitle = routeTitles[location.pathname] || 'Overview'

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formattedDate = useMemo(() => currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }), [currentTime])

  const formattedTime = useMemo(() => currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }), [currentTime])

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
              placeholder="Search devices / IMEI..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchValue.trim()) {
                  const q = searchValue.trim()
                  if (/^\d{10,18}$/.test(q)) {
                    navigate(`/locks/${q}`)
                  } else {
                    navigate(`/locks?search=${encodeURIComponent(q)}`)
                  }
                }
              }}
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

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unacknowledgedCount > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900">
                  {unacknowledgedCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</h3>
                    <div className="flex items-center gap-2">
                      {unacknowledgedCount > 0 && (
                        <button
                          onClick={() => {
                            acknowledgeAllAlerts()
                          }}
                          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
                          title="Mark all as read"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          Read all
                        </button>
                      )}
                      {unacknowledgedCount > 0 && (
                        <span className="text-xs font-medium text-red-600 dark:text-red-400">
                          {unacknowledgedCount} new
                        </span>
                      )}
                    </div>
                  </div>
                  {unacknowledgedAlerts.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No new notifications</p>
                    </div>
                  ) : (
                    <>
                      {unacknowledgedAlerts.slice(0, 5).map(alert => (
                        <button
                          key={alert.id}
                          onClick={() => {
                            setShowNotifications(false)
                            navigate(`/locks/${alert.deviceId}`)
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex-shrink-0">
                              {alert.severity === 'critical' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                              {alert.severity === 'warning' && <AlertCircle className="h-4 w-4 text-amber-500" />}
                              {alert.severity === 'info' && <Info className="h-4 w-4 text-blue-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-900 dark:text-white truncate">{alert.message}</p>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                                {alert.deviceId} &middot; {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setShowNotifications(false)
                          navigate('/alerts')
                        }}
                        className="w-full px-4 py-3 text-sm font-medium text-primary-600 hover:bg-slate-50 dark:text-primary-400 dark:hover:bg-slate-700 transition-colors text-center"
                      >
                        View all alerts
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

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
})