import { useState } from 'react'
import Card from '@/components/ui/Card'
import StatusBadge from '@/components/ui/StatusBadge'
import { useTheme } from '@/context/ThemeContext'
import { useRefresh } from '@/context/RefreshContext'
import { deviceService } from '@/services/deviceService'
import {
  Settings,
  Bell,
  Monitor,
  Database,
  Mail,
  Smartphone,
  BellRing,
  Lock,
  Shield,
  Battery,
  MapPin,
  Wifi,
  Radio,
  Trash2,
  Check,
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
  const [clearingDb, setClearingDb] = useState(false)
  const [clearSuccess, setClearSuccess] = useState(false)

  const handleClearAllDevices = async () => {
    if (!window.confirm('Are you sure you want to clear all devices and reset the local/server database?')) return
    setClearingDb(true)
    try {
      await deviceService.clearAllDevices()
      setClearSuccess(true)
      setTimeout(() => {
        window.location.reload()
      }, 700)
    } catch {
      setClearingDb(false)
    }
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
            <Radio className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">AWS IoT Core MQTT Broker</h2>
          </div>
          <StatusBadge label="Broker Active" variant="success" pulse />
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Broker Endpoint</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value="avj249ldc7joq-ats.iot.ap-south-1.amazonaws.com"
                disabled
                className="flex-1 max-w-md rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              />
              <StatusBadge label="Port 8883" variant="neutral" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Protocol & Security</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value="MQTTS (TLS 1.2 Mutual Certificate Authentication)"
                disabled
                className="flex-1 max-w-md rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              />
              <StatusBadge label="TLS Secured" variant="success" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Active Telemetry Topic Pattern</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value="soundbox_dev/{imei}/metrics"
                disabled
                className="flex-1 max-w-md rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
              />
              <StatusBadge label="Subscribed" variant="success" />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Database & Storage Management</h2>
        </div>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Reset all stored telemetry, clear local device cache, and wipe the server database. Newly registered smart lock devices will stream live metrics directly from the MQTT broker.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClearAllDevices}
            disabled={clearingDb || clearSuccess}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-rose-700 transition disabled:opacity-50"
          >
            {clearSuccess ? (
              <>
                <Check className="h-4 w-4" />
                Cleared! Reloading...
              </>
            ) : clearingDb ? (
              'Clearing Database...'
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Clear Database & Reset All Devices
              </>
            )}
          </button>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Data Sources</h2>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/30 dark:bg-emerald-900/10">
          <div className="flex items-center gap-3">
            <StatusBadge label="Pure Real-Time MQTT" variant="success" size="md" pulse />
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Direct Telemetry Stream from AWS IoT Core MQTT Broker
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All device telemetry, GPS coordinates, lock status, door sensor states, and motion diagnostics are streamed in real time over MQTT topics (<code className="text-xs bg-emerald-100 dark:bg-emerald-950 px-1 py-0.5 rounded">soundbox_dev/&#123;imei&#125;/metrics</code>) through WebSocket. No external REST API or polling endpoint is used.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
