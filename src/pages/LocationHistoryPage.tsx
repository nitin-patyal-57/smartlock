import { useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import { divIcon } from 'leaflet'
import { useDevices, useLocationHistory } from '@/hooks/useDevices'
import { useTheme } from '@/context/ThemeContext'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { Search, MapPin, ExternalLink, Route, Clock, Ruler } from 'lucide-react'
import type { LocationHistoryEntry } from '@/types/smartlock'

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function createNumberIcon(num: number) {
  return divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:#3b82f6;color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);">${num}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

export default function LocationHistoryPage() {
  const { devices, loading: devicesLoading } = useDevices()
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [searched, setSearched] = useState(false)
  const [showRoute, setShowRoute] = useState(false)
  const { isDark } = useTheme()

  const { history: locations, loading: locationsLoading } = useLocationHistory(
    searched ? selectedDevice : '',
    from || undefined,
    to || undefined
  )

  const stats = useMemo(() => {
    if (locations.length < 2) return { distance: 0, duration: 0 }
    let totalDistance = 0
    for (let i = 1; i < locations.length; i++) {
      totalDistance += calculateDistance(
        locations[i - 1].latitude as number,
        locations[i - 1].longitude as number,
        locations[i].latitude as number,
        locations[i].longitude as number
      )
    }
    const first = new Date(locations[0].timestamp)
    const last = new Date(locations[locations.length - 1].timestamp)
    const duration = (last.getTime() - first.getTime()) / 3600000
    return { distance: totalDistance, duration }
  }, [locations])

  const handleSearch = () => {
    if (selectedDevice) setSearched(true)
  }

  const routeCenter = useMemo(() => {
    if (locations.length === 0) return [40, -74]
    const lat = locations.reduce((s: number, l: LocationHistoryEntry) => s + l.latitude, 0) / locations.length
    const lng = locations.reduce((s: number, l: LocationHistoryEntry) => s + l.longitude, 0) / locations.length
    return [lat, lng]
  }, [locations])

  if (devicesLoading) return <LoadingSpinner message="Loading devices..." />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Location History</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Track device movements over time</p>
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Device</label>
            <select
              value={selectedDevice}
              onChange={e => setSelectedDevice(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            >
              <option value="">Select a device</option>
              {devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.deviceName} ({d.deviceId})
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">From</label>
            <input
              type="datetime-local"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">To</label>
            <input
              type="datetime-local"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={!selectedDevice}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            <Search className="h-4 w-4" />
            Search
          </button>
        </div>
      </Card>

      {searched && locationsLoading && <LoadingSpinner message="Fetching location history..." />}

      {searched && !locationsLoading && locations.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                <Ruler className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Total Distance</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{stats.distance.toFixed(2)} km</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30">
                <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Trip Duration</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{stats.duration.toFixed(1)} hours</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
                <MapPin className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Data Points</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{locations.length}</p>
              </div>
            </Card>
          </div>

          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Device</th>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Latitude</th>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Longitude</th>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Speed</th>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Date/Time</th>
                    <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {locations.map((loc: LocationHistoryEntry, idx: number) => (
                    <tr key={loc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3 text-slate-900 dark:text-white">{loc.deviceId}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{loc.latitude.toFixed(6)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{loc.longitude.toFixed(6)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{loc.speed.toFixed(1)} km/h</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {new Date(loc.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${loc.latitude}&mlon=${loc.longitude}#map=16/${loc.latitude}/${loc.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 dark:text-primary-400"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex justify-end">
            <button
              onClick={() => setShowRoute(!showRoute)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              <Route className="h-4 w-4" />
              {showRoute ? 'Hide Route' : 'View Route'}
            </button>
          </div>

          {showRoute && (
            <Card padding="none" className="overflow-hidden">
              <MapContainer
                center={routeCenter as [number, number]}
                zoom={6}
                style={{ height: '400px', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url={
                    isDark
                      ? 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png'
                      : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                  }
                />
                {locations.map((loc: LocationHistoryEntry, idx: number) => (
                  <Marker
                    key={loc.id}
                    position={[loc.latitude, loc.longitude]}
                    icon={createNumberIcon(idx + 1)}
                  >
                    <Popup>
                      <div>
                        <p className="font-medium">#{idx + 1}</p>
                        <p className="text-xs text-slate-500">{new Date(loc.timestamp).toLocaleString()}</p>
                        <p className="text-xs">Speed: {loc.speed.toFixed(1)} km/h</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
                {locations.length > 1 && (
                  <Polyline
                    positions={locations.map((l: LocationHistoryEntry) => [l.latitude, l.longitude] as [number, number])}
                    pathOptions={{ color: '#3b82f6', weight: 3, opacity: 0.8 }}
                  />
                )}
              </MapContainer>
            </Card>
          )}
        </>
      )}

      {searched && !locationsLoading && locations.length === 0 && (
        <EmptyState
          icon={<MapPin className="h-12 w-12" />}
          title="No location data found"
          description="Try selecting a different device or date range."
        />
      )}

      {!searched && (
        <EmptyState
          icon={<MapPin className="h-12 w-12" />}
          title="Select a device to view history"
          description="Choose a device and date range to see location history."
        />
      )}
    </div>
  )
}
