import { useState } from 'react'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import { useTheme } from '@/context/ThemeContext'
import { useRefresh } from '@/context/RefreshContext'
import {
  Settings,
  Bell,
  Monitor,
  Key,
  Database,
  Globe,
  Mail,
  Smartphone,
  BellRing,
  Lock,
  Shield,
  Battery,
  MapPin,
  Wifi,
  RefreshCw,
} from 'lucide-react'

interface ToggleProps {
  label: string
  description?: string
  enabled: boolean
  onChange: (v: boolean) => void
  icon?: React.ReactNode
}

function Toggle({ label, description, enabled, onChange, icon }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        {icon && <div className="text-slate-400">{icon}</div>}
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">{label}</p>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const { isDark, toggleTheme } = useTheme()
  const { refreshInterval, setRefreshInterval, isAutoRefreshEnabled, toggleAutoRefresh } = useRefresh()
  const [dashboardName, setDashboardName] = useState('Smart Lock Dashboard')
  const [timezone, setTimezone] = useState('America/New_York')
  const [compactMode, setCompactMode] = useState(false)
  const [defaultMapView, setDefaultMapView] = useState('street')
  const [walnutImei, setWalnutImei] = useState(() => {
    return (typeof window !== 'undefined' && localStorage.getItem('walnut_imei')) || import.meta.env.VITE_WALNUT_IMEI || '861185084122719,867509082945058'
  })
  const [savedSuccess, setSavedSuccess] = useState(false)

  const handleSaveImei = () => {
    localStorage.setItem('walnut_imei', walnutImei.trim())
    setSavedSuccess(true)
    setTimeout(() => {
      setSavedSuccess(false)
      window.location.reload()
    }, 800)
  }

  const [notifications, setNotifications] = useState({
    emailFailedUnlock: true,
    emailTamper: true,
    emailLowBattery: true,
    emailGeofence: false,
    emailOffline: false,
    smsFailedUnlock: false,
    smsTamper: true,
    smsLowBattery: false,
    smsGeofence: false,
    smsOffline: false,
    pushFailedUnlock: true,
    pushTamper: true,
    pushLowBattery: true,
    pushGeofence: true,
    pushOffline: true,
  })

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configure your dashboard preferences</p>
      </div>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">General</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Dashboard Name</label>
            <input
              type="text"
              value={dashboardName}
              onChange={e => setDashboardName(e.target.value)}
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Refresh Interval (seconds)
            </label>
            <select
              value={refreshInterval}
              onChange={e => setRefreshInterval(parseInt(e.target.value, 10))}
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="1">1 second (Real-Time MQTT)</option>
              <option value="5">5 seconds</option>
              <option value="10">10 seconds</option>
              <option value="30">30 seconds</option>
              <option value="60">1 minute</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Timezone</label>
            <select
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Notifications</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Mail className="h-4 w-4" /> Email
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              <Toggle label="Failed Unlock" enabled={notifications.emailFailedUnlock} onChange={() => toggleNotification('emailFailedUnlock')} icon={<Lock className="h-4 w-4" />} />
              <Toggle label="Tamper Alert" enabled={notifications.emailTamper} onChange={() => toggleNotification('emailTamper')} icon={<Shield className="h-4 w-4" />} />
              <Toggle label="Low Battery" enabled={notifications.emailLowBattery} onChange={() => toggleNotification('emailLowBattery')} icon={<Battery className="h-4 w-4" />} />
              <Toggle label="Geofence Violation" enabled={notifications.emailGeofence} onChange={() => toggleNotification('emailGeofence')} icon={<MapPin className="h-4 w-4" />} />
              <Toggle label="Offline Device" enabled={notifications.emailOffline} onChange={() => toggleNotification('emailOffline')} icon={<Wifi className="h-4 w-4" />} />
            </div>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Smartphone className="h-4 w-4" /> SMS
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              <Toggle label="Failed Unlock" enabled={notifications.smsFailedUnlock} onChange={() => toggleNotification('smsFailedUnlock')} icon={<Lock className="h-4 w-4" />} />
              <Toggle label="Tamper Alert" enabled={notifications.smsTamper} onChange={() => toggleNotification('smsTamper')} icon={<Shield className="h-4 w-4" />} />
              <Toggle label="Low Battery" enabled={notifications.smsLowBattery} onChange={() => toggleNotification('smsLowBattery')} icon={<Battery className="h-4 w-4" />} />
              <Toggle label="Geofence Violation" enabled={notifications.smsGeofence} onChange={() => toggleNotification('smsGeofence')} icon={<MapPin className="h-4 w-4" />} />
              <Toggle label="Offline Device" enabled={notifications.smsOffline} onChange={() => toggleNotification('smsOffline')} icon={<Wifi className="h-4 w-4" />} />
            </div>
          </div>

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <BellRing className="h-4 w-4" /> Push
            </h3>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              <Toggle label="Failed Unlock" enabled={notifications.pushFailedUnlock} onChange={() => toggleNotification('pushFailedUnlock')} icon={<Lock className="h-4 w-4" />} />
              <Toggle label="Tamper Alert" enabled={notifications.pushTamper} onChange={() => toggleNotification('pushTamper')} icon={<Shield className="h-4 w-4" />} />
              <Toggle label="Low Battery" enabled={notifications.pushLowBattery} onChange={() => toggleNotification('pushLowBattery')} icon={<Battery className="h-4 w-4" />} />
              <Toggle label="Geofence Violation" enabled={notifications.pushGeofence} onChange={() => toggleNotification('pushGeofence')} icon={<MapPin className="h-4 w-4" />} />
              <Toggle label="Offline Device" enabled={notifications.pushOffline} onChange={() => toggleNotification('pushOffline')} icon={<Wifi className="h-4 w-4" />} />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Display</h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          <Toggle
            label="Dark Mode"
            description="Switch between light and dark themes"
            enabled={isDark}
            onChange={toggleTheme}
          />
          <Toggle
            label="Compact Mode"
            description="Show more content with less spacing"
            enabled={compactMode}
            onChange={setCompactMode}
          />
          <div className="py-3">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Default Map View</label>
            <div className="flex gap-3">
              <button
                onClick={() => setDefaultMapView('street')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  defaultMapView === 'street'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                Street View
              </button>
              <button
                onClick={() => setDefaultMapView('satellite')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  defaultMapView === 'satellite'
                    ? 'bg-primary-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                Satellite View
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-slate-500 dark:text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Walnut IoT & API Configuration</h2>
          </div>
          <StatusBadge label="Live API" variant="success" pulse />
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Target IMEI(s)</label>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Enter one or multiple device IMEIs separated by commas (e.g. 861185084122719, 867509082945058)
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={walnutImei}
                onChange={e => setWalnutImei(e.target.value)}
                placeholder="861185084122719"
                className="flex-1 max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
              <button
                type="button"
                onClick={handleSaveImei}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                {savedSuccess ? 'Saved!' : 'Save & Refresh'}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">API Endpoint</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value="https://dev.walnutmedical.ai/api/soundbox/smart_logs"
                disabled
                className="flex-1 max-w-md rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
              />
              <StatusBadge label="Connected" variant="success" />
            </div>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Auto Refresh</label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automatically refresh data every {refreshInterval} seconds
              </p>
            </div>
            <button
              onClick={toggleAutoRefresh}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isAutoRefreshEnabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAutoRefreshEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Polling Interval</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={`${refreshInterval}s`}
                disabled
                className="w-32 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
              />
              <StatusBadge label={isAutoRefreshEnabled ? 'Active' : 'Paused'} variant={isAutoRefreshEnabled ? 'success' : 'warning'} />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Data Sources</h2>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/30 dark:bg-emerald-900/10">
          <div className="flex items-center gap-3">
            <StatusBadge label="Walnut IoT Live" variant="success" size="md" pulse />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Live Integration with Walnut Medical Soundbox & Smart Lock API
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Data is actively fetched from <code className="text-xs bg-emerald-100 dark:bg-emerald-950 px-1 py-0.5 rounded">https://dev.walnutmedical.ai</code> for configured IMEI numbers (including {walnutImei}).
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
