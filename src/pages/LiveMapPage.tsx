import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { useDevices } from '@/hooks/useDevices'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
  MapPin, Battery, Lock, Unlock, Navigation, Gauge,
  Compass, Satellite, Eye, Crosshair, ArrowRight
} from 'lucide-react'
import type { SmartLockDevice } from '@/types/smartlock'
import {
  MAP_LAYERS,
  type MapLayerType,
  createMovingVehicleMarker,
  createStationaryMarker,
  isDeviceMoving,
} from '@/components/map/mapLayers'
import { MapLayerSwitcher } from '@/components/map/MapLayerSwitcher'

/**
 * Controller to smoothly pan the map when following a moving device or centering.
 */
function MapFollowController({
  targetPos,
  isFollowing,
}: {
  targetPos: [number, number] | null
  isFollowing: boolean
}) {
  const map = useMap()
  const lastPosRef = useRef<[number, number] | null>(null)

  useEffect(() => {
    if (!targetPos) return
    const [lat, lng] = targetPos
    if (lat === 0 && lng === 0) return

    if (isFollowing) {
      map.panTo(targetPos, { animate: true, duration: 0.8 })
    } else if (!lastPosRef.current) {
      map.setView(targetPos, 14, { animate: true })
    }
    lastPosRef.current = targetPos
  }, [targetPos, isFollowing, map])

  return null
}

function DevicePopupContent({
  device,
  isMoving,
}: {
  device: SmartLockDevice
  isMoving: boolean
}) {
  const navigate = useNavigate()
  return (
    <div className="min-w-[220px] p-1 font-sans">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">{device.deviceName}</h3>
          <p className="font-mono text-[11px] text-slate-500">{device.deviceId}</p>
        </div>
        <span
          className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
            isMoving
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {isMoving ? '🚗 Moving' : '🅿️ Parked'}
        </span>
      </div>

      <div className="my-2.5 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Gauge className="h-3.5 w-3.5 text-emerald-500" /> Speed:
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-100">
            {device.gps.speed.toFixed(1)} km/h
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Compass className="h-3.5 w-3.5 text-blue-500" /> Heading:
          </span>
          <span className="font-medium text-slate-800 dark:text-slate-100">
            {Math.round(device.gps.heading)}°
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Battery className="h-3.5 w-3.5 text-emerald-500" /> Battery:
          </span>
          <span className="font-medium text-slate-800 dark:text-slate-100">
            {device.power.batteryPercentage}% ({device.power.batteryVoltage}V)
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-500">
            {device.lock.lockStatus ? (
              <Lock className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <Unlock className="h-3.5 w-3.5 text-emerald-500" />
            )}
            Lock State:
          </span>
          <span className="font-medium text-slate-800 dark:text-slate-100">
            {device.lock.lockStatus ? 'Locked' : 'Unlocked'}
          </span>
        </div>
      </div>

      <button
        onClick={() => navigate(`/locks/${device.deviceId}`)}
        className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700"
      >
        <span>Open Device Telemetry</span>
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  )
}

export default function LiveMapPage() {
  const navigate = useNavigate()
  const { devices, loading } = useDevices()
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('google-streets')
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState<boolean>(false)
  const [filterMode, setFilterMode] = useState<'all' | 'moving' | 'stationary'>('all')

  // In-memory breadcrumb trails for active session
  const [trails, setTrails] = useState<Record<string, [number, number][]>>({})

  // Update history trails whenever devices report valid new coordinates
  useEffect(() => {
    if (!devices || devices.length === 0) return

    setTrails((prev) => {
      let updated = false
      const nextTrails = { ...prev }

      devices.forEach((d) => {
        if (!d.gps || d.gps.latitude === 0 || d.gps.longitude === 0) return
        const newPoint: [number, number] = [d.gps.latitude, d.gps.longitude]
        const existing = nextTrails[d.deviceId] || []

        if (existing.length === 0) {
          nextTrails[d.deviceId] = [newPoint]
          updated = true
        } else {
          const lastPoint = existing[existing.length - 1]
          // Append if moved more than ~1 meter
          const dist = Math.hypot(lastPoint[0] - newPoint[0], lastPoint[1] - newPoint[1])
          if (dist > 0.00002) {
            // Keep last 60 points (1-2 minutes of real-time movement)
            nextTrails[d.deviceId] = [...existing.slice(-59), newPoint]
            updated = true
          }
        }
      })

      return updated ? nextTrails : prev
    })
  }, [devices])

  // Select first valid device by default if none selected
  useEffect(() => {
    if (!selectedDeviceId && devices.length > 0) {
      const firstValid = devices.find((d) => d.gps.latitude !== 0 && d.gps.longitude !== 0)
      if (firstValid) {
        setSelectedDeviceId(firstValid.deviceId)
      }
    }
  }, [devices, selectedDeviceId])

  const validGpsDevices = useMemo(() => {
    return devices.filter((d) => d.gps.latitude !== 0 && d.gps.longitude !== 0)
  }, [devices])

  const movingDevices = useMemo(() => {
    return validGpsDevices.filter((d) => isDeviceMoving(d))
  }, [validGpsDevices])

  const stationaryDevices = useMemo(() => {
    return validGpsDevices.filter((d) => !isDeviceMoving(d))
  }, [validGpsDevices])

  const displayedDevices = useMemo(() => {
    if (filterMode === 'moving') return movingDevices
    if (filterMode === 'stationary') return stationaryDevices
    return validGpsDevices
  }, [filterMode, validGpsDevices, movingDevices, stationaryDevices])

  const activeDevice = useMemo(() => {
    return devices.find((d) => d.deviceId === selectedDeviceId) || validGpsDevices[0]
  }, [devices, selectedDeviceId, validGpsDevices])

  const activePos = useMemo<[number, number] | null>(() => {
    if (activeDevice && activeDevice.gps.latitude !== 0 && activeDevice.gps.longitude !== 0) {
      return [activeDevice.gps.latitude, activeDevice.gps.longitude]
    }
    return null
  }, [activeDevice])

  const initialCenter = useMemo<[number, number]>(() => {
    if (validGpsDevices.length > 0) {
      return [validGpsDevices[0].gps.latitude, validGpsDevices[0].gps.longitude]
    }
    return [30.704649, 76.717873] // Default Mohali / Punjab
  }, [validGpsDevices])

  const activeLayerConfig = MAP_LAYERS[currentLayer] || MAP_LAYERS['google-streets']

  if (loading) return <LoadingSpinner message="Connecting to live GPS map..." />

  return (
    <div className="relative h-[calc(100vh-170px)] w-full overflow-hidden rounded-2xl shadow-xl">
      {/* Top Floating Controls Bar */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: Device Filter Chips & Stats */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <Card padding="sm" className="shadow-lg backdrop-blur-md bg-white/95 dark:bg-slate-900/95">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <button
                onClick={() => setFilterMode('all')}
                className={`rounded-lg px-2.5 py-1.5 transition ${
                  filterMode === 'all'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                All ({validGpsDevices.length})
              </button>
              <button
                onClick={() => setFilterMode('moving')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
                  filterMode === 'moving'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Moving ({movingDevices.length})
              </button>
              <button
                onClick={() => setFilterMode('stationary')}
                className={`rounded-lg px-2.5 py-1.5 transition ${
                  filterMode === 'stationary'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                Stationary ({stationaryDevices.length})
              </button>
            </div>
          </Card>
        </div>

        {/* Right: Map Layer Switcher (Google Maps, Satellite, Hybrid, Traffic) */}
        <div className="pointer-events-auto flex items-center gap-2">
          <MapLayerSwitcher currentLayer={currentLayer} onLayerChange={setCurrentLayer} />
        </div>
      </div>

      {/* Main Map Container */}
      <MapContainer
        center={initialCenter}
        zoom={validGpsDevices.length > 0 ? 14 : 6}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          key={activeLayerConfig.id}
          url={activeLayerConfig.url}
          subdomains={activeLayerConfig.subdomains || []}
          maxZoom={activeLayerConfig.maxZoom}
          attribution={activeLayerConfig.attribution}
        />

        {/* Auto Follow / Pan Controller */}
        <MapFollowController targetPos={activePos} isFollowing={isFollowing} />

        {/* Live Breadcrumb Trails for Moving Vehicles */}
        {Object.entries(trails).map(([deviceId, positions]) => {
          if (positions.length < 2) return null
          const isSelected = selectedDeviceId === deviceId
          return (
            <Polyline
              key={`trail-${deviceId}`}
              positions={positions}
              pathOptions={{
                color: isSelected ? '#10b981' : '#3b82f6',
                weight: isSelected ? 4 : 3,
                opacity: 0.85,
                dashArray: isSelected ? undefined : '6, 6',
              }}
            />
          )
        })}

        {/* Markers for all displayed devices */}
        {displayedDevices.map((device) => {
          const moving = isDeviceMoving(device)
          const isSelected = selectedDeviceId === device.deviceId
          const icon = moving
            ? createMovingVehicleMarker(
                device.gps.heading,
                device.gps.speed,
                device.deviceName
              )
            : createStationaryMarker(device.status, device.lock.lockStatus)

          return (
            <Marker
              key={device.deviceId}
              position={[device.gps.latitude, device.gps.longitude]}
              icon={icon}
              zIndexOffset={isSelected ? 1000 : moving ? 500 : 100}
              eventHandlers={{
                click: () => {
                  setSelectedDeviceId(device.deviceId)
                },
              }}
            >
              <Popup>
                <DevicePopupContent device={device} isMoving={moving} />
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>

      {/* Floating Bottom Telemetry HUD Card for Active Vehicle */}
      {activeDevice && activePos && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-4 sm:right-auto sm:max-w-md z-[1000]">
          <Card padding="md" className="shadow-2xl border-emerald-500/30 backdrop-blur-md bg-white/95 dark:bg-slate-900/95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md ${
                    isDeviceMoving(activeDevice)
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                      : 'bg-gradient-to-br from-slate-600 to-slate-800'
                  }`}
                >
                  <Navigation
                    className="h-5 w-5 transition-transform duration-300"
                    style={{
                      transform: `rotate(${Math.round(activeDevice.gps.heading)}deg)`,
                    }}
                  />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {activeDevice.deviceName}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-500">
                      {activeDevice.deviceId}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isDeviceMoving(activeDevice)
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {isDeviceMoving(activeDevice) ? '● LIVE MOVING' : '○ STATIONARY'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Follow Toggle */}
              <button
                onClick={() => setIsFollowing(!isFollowing)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-xs transition ${
                  isFollowing
                    ? 'bg-emerald-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
                title="Keep camera centered on this moving vehicle"
              >
                <Crosshair className={`h-3.5 w-3.5 ${isFollowing ? 'animate-spin' : ''}`} />
                <span>{isFollowing ? 'Following' : 'Follow'}</span>
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                <p className="text-[10px] uppercase font-bold text-slate-400">Speed</p>
                <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                  {activeDevice.gps.speed.toFixed(1)} <span className="text-[10px] font-normal">km/h</span>
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                <p className="text-[10px] uppercase font-bold text-slate-400">Heading</p>
                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  {Math.round(activeDevice.gps.heading)}°
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                <p className="text-[10px] uppercase font-bold text-slate-400">Satellites</p>
                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  {activeDevice.gps.satellites}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
                <p className="text-[10px] uppercase font-bold text-slate-400">Battery</p>
                <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  {activeDevice.power.batteryPercentage}%
                </p>
              </div>
            </div>

            {/* Location coordinates */}
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 font-mono">
                <MapPin className="h-3 w-3 text-rose-500" />
                {activeDevice.gps.latitude.toFixed(6)}, {activeDevice.gps.longitude.toFixed(6)}
              </span>
              <span className="text-[10px]">
                Alt: {activeDevice.gps.altitude}m
              </span>
            </div>

            {/* Open Device Telemetry Details */}
            <button
              onClick={() => navigate(`/locks/${activeDevice.deviceId}`)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition"
            >
              <span>View Device Details & Controls</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </Card>
        </div>
      )}
    </div>
  )
}
