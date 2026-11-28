import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Lock,
  MapPin,
  Clock,
  Battery,
  Activity,
  Bell,
  BarChart3,
  Settings,
  Sun,
  Moon,
  X,
  Shield,
} from 'lucide-react'
import { cn } from '@/utils/helpers'
import { useTheme } from '@/context/ThemeContext'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/locks', icon: Lock, label: 'Smart Locks' },
  { to: '/map', icon: MapPin, label: 'Live Map' },
  { to: '/history', icon: Clock, label: 'History' },
  { to: '/battery-history', icon: Battery, label: 'Battery History' },
  { to: '/lock-activity', icon: Activity, label: 'Lock Activity' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 flex flex-col',
          'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950',
          'dark:from-[#060a14] dark:via-[#090f1e] dark:to-[#060a14]',
          'border-r border-slate-800 dark:border-slate-800/80 shadow-2xl',
          'transition-all duration-300 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-500 shadow-lg shadow-emerald-500/30">
              <Shield className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <span className="text-xl font-black text-white tracking-tight">SmartLock</span>
              <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Dashboard Pro</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 lg:hidden transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold',
                  'transition-all duration-200 group relative',
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent text-emerald-400 border-l-4 border-emerald-400 pl-[9px] shadow-sm shadow-emerald-500/15'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border-l-4 border-transparent pl-[9px]'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'w-5 h-5 flex-shrink-0 transition-all duration-200',
                      isActive ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'text-slate-400 group-hover:text-slate-200'
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700/50">
          <button
            onClick={toggleTheme}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium',
              'text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all duration-200'
            )}
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-400" />
            )}
            <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </aside>
    </>
  )
}
