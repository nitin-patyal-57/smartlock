import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { useDevices } from '@/hooks/useDevices'
import { useTheme } from '@/context/ThemeContext'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { MapPin, Battery, Lock, Unlock } from 'lucide-react'
import type { SmartLockDevice } from '@/types/smartlock'

const createMarkerIcon = (color: string) =>
  divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })

const statusColors: Record<string, string> = {
  online: '#22c55e',
  offline: '#ef4444',
  warning: '#eab308',
}

const markerIconCache: Record<string, ReturnType<typeof divIcon>> = {}
function getMarkerIcon(status: string) {
  const color = statusColors[status] || statusColors.offline
  if (!markerIconCache[color]) {
    markerIconCache[color] = createMarkerIcon(color)
  }
  return markerIconCache[color]
}

function DevicePopup({ device }: { device: SmartLockDevice }) {
  const navigate = useNavigate()
  return (
    <div className="min-w-[200px]">
      <h3 className="font-semibold text-slate-900 dark:text-white">{device.deviceName}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{device.deviceId}</p>
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2">
          <Battery className="h-3.5 w-3.5" />
          <span>{device.power.batteryPercentage}%</span>
        </div>
        <div className="flex items-center gap-2">
          {device.lock.lockStatus ? (
            <Lock className="h-3.5 w-3.5 text-red-500" />
          ) : (
            <Unlock className="h-3.5 w-3.5 text-emerald-500" />
          )}
          <span>{device.lock.lockStatus ? 'Locked' : 'Unlocked'}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5" />
          <span>{device.gps.speed.toFixed(1)} km/h</span>
        </div>
      </div>
      <button
        onClick={() => navigate(`/locks/${device.deviceId}`)}
        className="mt-3 w-full rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
      >
        View Details
      </button>
    </div>
  )
}

export default function LiveMapPage() {
  const { devices, loading } = useDevices()
  const { isDark } = useTheme()

  const stats = useMemo(() => {
    const online = devices.filter(d => d.status === 'online').length
    const offline = devices.filter(d => d.status === 'offline').length
    const warning = devices.filter(d => d.status === 'warning').length
    return { total: devices.length, online, offline, warning }
  }, [devices])

  const validGpsDevices = useMemo(() => {
    return devices.filter(d => d.gps.latitude !== 0 && d.gps.longitude !== 0)
  }, [devices])

  const pendingGpsCount = devices.length - validGpsDevices.length

  const center = useMemo(() => {
    if (validGpsDevices.length === 0) return [30.7046, 76.7178] // Default Mohali / India
    const lat = validGpsDevices.reduce((s, d) => s + d.gps.latitude, 0) / validGpsDevices.length
    const lng = validGpsDevices.reduce((s, d) => s + d.gps.longitude, 0) / validGpsDevices.length
    return [lat, lng]
  }, [validGpsDevices])

  if (loading) return <LoadingSpinner message="Loading map..." />

  return (
    <div className="relative h-[calc(100vh-180px)] w-full">
      <MapContainer
        center={center as [number, number]}
        zoom={validGpsDevices.length > 0 ? 12 : 4}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url={
            isDark
              ? 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png'
              : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
          }
        />
        {validGpsDevices.map(device => (
          <Marker
            key={device.deviceId}
            position={[device.gps.latitude, device.gps.longitude]}
            icon={getMarkerIcon(device.status)}
          >
            <Popup>
              <DevicePopup device={device} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute top-4 left-4 z-[1000]">
        <Card className="shadow-lg">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.online}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Online</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.offline}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Offline</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.warning}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Warning</p>
            </div>
            {pendingGpsCount > 0 && (
              <>
                <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-500 dark:text-slate-400">{pendingGpsCount}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">GPS Pending</p>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      <div className="absolute bottom-4 left-4 z-[1000]">
        <Card className="shadow-lg p-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-emerald-500" />
              <span className="text-xs text-slate-700 dark:text-slate-300">Online</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <span className="text-xs text-slate-700 dark:text-slate-300">Offline</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-amber-500" />
              <span className="text-xs text-slate-700 dark:text-slate-300">Warning</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
