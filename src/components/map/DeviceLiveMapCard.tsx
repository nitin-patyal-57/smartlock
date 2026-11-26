import { useState, useMemo, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import {
  Compass, Satellite, MapPin, Crosshair, Navigation, Gauge,
  Activity, RotateCcw, Battery, Wifi, ShieldCheck, Lock, Unlock
} from 'lucide-react'
import type { SmartLockDevice } from '@/types/smartlock'
import {
  MAP_LAYERS,
  type MapLayerType,
  createMovingVehicleMarker,
  createStationaryMarker,
  isDeviceMoving,
} from './mapLayers'
import { MapLayerSwitcher } from './MapLayerSwitcher'

interface DeviceLiveMapCardProps {
  device: SmartLockDevice
  height?: string
}

/**
 * Controller to smoothly pan the map when following the moving device.
 */
function MapFollowController({
  targetPos,
  isFollowing,
}: {
  targetPos: [number, number]
  isFollowing: boolean
}) {
  const map = useMap()
  const lastPosRef = useRef<[number, number] | null>(null)

  useEffect(() => {
    if (!targetPos || (targetPos[0] === 0 && targetPos[1] === 0)) return

    if (!lastPosRef.current) {
      map.setView(targetPos, 16, { animate: true })
    } else if (isFollowing) {
      map.panTo(targetPos, { animate: true, duration: 0.8 })
    }
    lastPosRef.current = targetPos
  }, [targetPos, isFollowing, map])

  return null
}

export function DeviceLiveMapCard({ device, height = 'h-[440px]' }: DeviceLiveMapCardProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('google-streets')
  const [isFollowing, setIsFollowing] = useState<boolean>(true)
  const [trail, setTrail] = useState<[number, number][]>([])

  const hasGps = Boolean(
    device.gps &&
      device.gps.latitude !== 0 &&
      device.gps.longitude !== 0 &&
      !isNaN(device.gps.latitude) &&
      !isNaN(device.gps.longitude)
  )

  const pos: [number, number] = useMemo(() => {
    return hasGps
      ? [device.gps.latitude, device.gps.longitude]
      : [30.657035, 76.729596]
  }, [hasGps, device.gps?.latitude, device.gps?.longitude])

  // Real-time motion detection from authentic hardware metrics
  const speed = device.gps?.speed || 0
  const heading = device.gps?.heading || 0
  const motionDetected = Boolean(device.accelerometer?.motion)
  const isMoving = isDeviceMoving(device)

  // Accumulate authentic breadcrumb trail as real GPS coordinates arrive
  useEffect(() => {
    if (!hasGps) return

    setTrail((prev) => {
      if (prev.length === 0) return [pos]
      const last = prev[prev.length - 1]
      const dist = Math.hypot(last[0] - pos[0], last[1] - pos[1])
      // Append if moved ~2 meters or more
      if (dist > 0.00002) {
        return [...prev.slice(-100), pos] // Keep last 100 real GPS points
      }
      return prev
    })
  }, [hasGps, pos])

  const activeLayerConfig = MAP_LAYERS[currentLayer] || MAP_LAYERS['google-streets']

  // Marker icon: Animated 3D Navigation Arrow when moving, Parked Lock Pin when stationary
  const markerIcon = useMemo(() => {
    if (!hasGps) return undefined
    if (isMoving) {
      return createMovingVehicleMarker(heading, speed, device.deviceName)
    }
    return createStationaryMarker(device.status, device.lock?.lockStatus)
  }, [hasGps, isMoving, heading, speed, device.deviceName, device.status, device.lock?.lockStatus])

  if (!hasGps) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/50">
        <MapPin className="h-10 w-10 text-slate-400 mb-2 animate-bounce" />
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          Awaiting GPS Satellite Fix
        </h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Device {device.deviceId} is connected to MQTT. Once GNSS satellites lock, real-time Google Maps movement plotting will begin automatically.
        </p>
      </div>
    )
  }

  return (
    <div className={`relative ${height} w-full overflow-hidden rounded-2xl border border-slate-200 shadow-xl dark:border-slate-800`}>
      {/* Top Floating Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Dynamic Real-Time Moving vs Stationary Status Pill */}
        <div className="pointer-events-auto flex items-center gap-2">
          {isMoving ? (
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-900/95 px-3.5 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md border border-emerald-500/40">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400 font-extrabold uppercase tracking-wide">
                  ● DEVICE IS MOVING
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-white font-mono text-sm font-black">
                  {speed.toFixed(1)} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300 font-mono text-xs flex items-center gap-1">
                  <Compass className="h-3 w-3 text-blue-400" />
                  {Math.round(heading)}°
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-900/95 px-3.5 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md border border-blue-500/40">
              <span className="h-3 w-3 rounded-full bg-blue-400"></span>
              <div className="flex items-center gap-2">
                <span className="text-blue-300 font-extrabold uppercase tracking-wide">
                  ○ DEVICE IS STATIONARY / PARKED
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300 font-mono text-xs">
                  0.0 km/h (At Rest)
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1">
                  {device.lock?.lockStatus ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Unlock className="h-3 w-3" /> Unlocked
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Accelerometer Vibration / Motion Detection Badge */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-slate-900/90 px-3 py-2 text-[11px] font-medium text-slate-300 shadow-md backdrop-blur-md border border-slate-700/60">
            <Activity className={`h-3.5 w-3.5 ${motionDetected ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
            <span>
              {motionDetected ? 'Motion Sensor: Active' : 'Motion: At Rest (No Vibration)'}
            </span>
          </div>
        </div>

        {/* Right: Camera Follow & Map Layer Switcher */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Follow Camera Switch */}
          <button
            onClick={() => setIsFollowing(!isFollowing)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold shadow-lg backdrop-blur-md border transition ${
              isFollowing
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/30'
                : 'bg-white/95 text-slate-700 hover:bg-slate-100 border-slate-200 dark:bg-slate-900/95 dark:text-slate-200 dark:border-slate-800'
            }`}
            title="Keep map camera centered on device location"
          >
            <Crosshair className={`h-3.5 w-3.5 ${isFollowing ? 'animate-spin' : ''}`} />
            <span>{isFollowing ? 'Following' : 'Follow'}</span>
          </button>

          {/* Clear Trail Button */}
          {trail.length > 1 && (
            <button
              onClick={() => setTrail([pos])}
              className="flex items-center gap-1 rounded-xl bg-white/95 px-2.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 shadow-lg backdrop-blur-md border border-slate-200 dark:bg-slate-900/95 dark:text-slate-300 dark:border-slate-800 transition"
              title="Reset plotted real-time road trail"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset Trail</span>
            </button>
          )}

          <MapLayerSwitcher currentLayer={currentLayer} onLayerChange={setCurrentLayer} />
        </div>
      </div>

      {/* Main Google Maps Leaflet Canvas */}
      <MapContainer
        key={`${pos[0]}-${pos[1]}`}
        center={pos}
        zoom={16}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        zoomControl={false}
      >
        <TileLayer
          key={activeLayerConfig.id}
          url={activeLayerConfig.url}
          subdomains={activeLayerConfig.subdomains || []}
          maxZoom={activeLayerConfig.maxZoom}
          attribution={activeLayerConfig.attribution}
        />

        {/* Camera Controller to track device */}
        <MapFollowController targetPos={pos} isFollowing={isFollowing} />

        {/* Real-time Traveled Road Trail (Solid Emerald Line) */}
        {trail.length > 1 && (
          <Polyline
            positions={trail}
            pathOptions={{
              color: '#10b981',
              weight: 5,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Real Hardware Marker */}
        {markerIcon && (
          <Marker position={pos} icon={markerIcon} zIndexOffset={1000}>
            <Popup>
              <div className="p-1 font-sans text-xs min-w-[180px]">
                <div className="flex items-center justify-between border-b pb-1">
                  <span className="font-bold text-slate-900">{device.deviceName}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      isMoving ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {isMoving ? 'MOVING' : 'PARKED'}
                  </span>
                </div>
                <div className="mt-1.5 space-y-1 text-slate-600 font-mono text-[11px]">
                  <p>IMEI: {device.deviceId}</p>
                  <p>Speed: {speed.toFixed(1)} km/h</p>
                  <p>Heading: {Math.round(heading)}°</p>
                  <p>Coordinates: {pos[0].toFixed(5)}, {pos[1].toFixed(5)}</p>
                  <p>Lock: {device.lock?.lockStatus ? '🔒 Locked' : '🔓 Unlocked'}</p>
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Bottom Floating Telemetry Overlay */}
      <div className="absolute bottom-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900/95 px-4 py-2 text-xs font-medium text-slate-200 shadow-xl backdrop-blur-md border border-slate-800">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-mono text-emerald-400">
            <MapPin className="h-3.5 w-3.5 text-rose-500" />
            {pos[0].toFixed(6)}, {pos[1].toFixed(6)}
          </span>
          <span className="hidden sm:flex items-center gap-1 text-slate-300">
            Alt: {device.gps?.altitude || 0}m
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <Satellite className="h-3.5 w-3.5" />
            {device.gps?.satellites || 0} Sats ({device.gps?.fixType || '3D'})
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-slate-300">
            <Battery className="h-3.5 w-3.5 text-emerald-400" />
            {device.power?.batteryPercentage || 100}% ({device.power?.batteryVoltage || '4.22'}V)
          </span>
          <span className="hidden md:flex items-center gap-1 text-slate-400 font-mono text-[11px]">
            <Wifi className="h-3.5 w-3.5 text-cyan-400" />
            {device.cellular?.operator || 'IND airtel'}
          </span>
          {trail.length > 1 && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">
              {trail.length} GPS Points Plotted
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
