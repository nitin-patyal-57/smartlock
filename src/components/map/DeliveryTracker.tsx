import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import {
  Play, Pause, RotateCcw, Compass, Gauge, Battery, Satellite,
  MapPin, Crosshair, Clock, CheckCircle2, Radio, Sparkles,
  Signal, ShieldCheck, ChevronRight
} from 'lucide-react'
import type { SmartLockDevice } from '@/types/smartlock'
import {
  MAP_LAYERS,
  type MapLayerType,
  createDeliveryBoyMarker,
  createStoreMarker,
  createCustomerDestinationMarker,
  isDeviceMoving,
} from './mapLayers'
import { MapLayerSwitcher } from './MapLayerSwitcher'
import Card from '@/components/ui/Card'

/**
 * Controller to smoothly keep camera centered on delivery boy.
 */
function MapCameraFollow({
  position,
  isFollowing,
}: {
  position: [number, number]
  isFollowing: boolean
}) {
  const map = useMap()
  const isFirstRef = useRef(true)

  useEffect(() => {
    if (!position || (position[0] === 0 && position[1] === 0)) return

    if (isFirstRef.current) {
      map.setView(position, 15, { animate: true })
      isFirstRef.current = false
    } else if (isFollowing) {
      map.panTo(position, { animate: true, duration: 0.6 })
    }
  }, [position, isFollowing, map])

  return null
}

/**
 * Calculate distance between two coordinates in kilometers (Haversine formula).
 */
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Calculate bearing angle between two coordinates in degrees (0 - 360).
 */
function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lon2 - lon1) * Math.PI) / 180)
  const bearing = (Math.atan2(y, x) * 180) / Math.PI
  return (bearing + 360) % 360
}

interface DeliveryTrackerProps {
  device: SmartLockDevice
  currentLayer?: MapLayerType
  onLayerChange?: (layer: MapLayerType) => void
  onSwitchToFleet?: () => void
}

export function DeliveryTracker({
  device,
  currentLayer = 'google-streets',
  onLayerChange,
  onSwitchToFleet,
}: DeliveryTrackerProps) {
  const [selectedLayer, setSelectedLayer] = useState<MapLayerType>(currentLayer)
  const [isFollowing, setIsFollowing] = useState<boolean>(true)
  const [mode, setMode] = useState<'simulation' | 'hardware'>('simulation')

  // Simulation controls
  const [isPlaying, setIsPlaying] = useState<boolean>(true)
  const [simSpeed, setSimSpeed] = useState<number>(1) // 1x, 2x, 4x

  // Reference device base coordinates (Mohali / Chandigarh)
  const baseLat = device.gps?.latitude && device.gps.latitude !== 0 ? device.gps.latitude : 30.657035
  const baseLng = device.gps?.longitude && device.gps.longitude !== 0 ? device.gps.longitude : 76.729596

  // Realistic delivery route waypoints along actual roads in Mohali
  const deliveryRoute = useMemo<[number, number][]>(() => {
    return [
      [baseLat - 0.0075, baseLng - 0.0090], // Store: Sector 68 Hub
      [baseLat - 0.0052, baseLng - 0.0065], // Sector 68 Main Rd
      [baseLat - 0.0030, baseLng - 0.0040], // Kumbra Chowk
      [baseLat, baseLng],                   // Device Current Position (Tested Hardware!)
      [baseLat + 0.0028, baseLng + 0.0035], // Sector 67 Commercial
      [baseLat + 0.0055, baseLng + 0.0070], // Phase 9 Dividing Rd
      [baseLat + 0.0078, baseLng + 0.0105], // Phase 9 Market
      [baseLat + 0.0105, baseLng + 0.0140], // Customer Destination: Phase 9 Society
    ]
  }, [baseLat, baseLng])

  const storeLocation = deliveryRoute[0]
  const customerLocation = deliveryRoute[deliveryRoute.length - 1]

  // Interpolated smooth animation position
  const [currentPos, setCurrentPos] = useState<[number, number]>(deliveryRoute[3])
  const [currentHeading, setCurrentHeading] = useState<number>(device.gps?.heading || 183)
  const [currentSpeed, setCurrentSpeed] = useState<number>(34.5)
  const [routeProgress, setRouteProgress] = useState<number>(0.42) // 0 to 1

  // Real-time breadcrumbs path traversed by rider
  const [traveledPath, setTraveledPath] = useState<[number, number][]>([])

  // Interpolate route coordinates for given progress (0 to 1)
  const getPositionAtProgress = useCallback(
    (progress: number): { pos: [number, number]; heading: number; segmentIndex: number } => {
      const clamped = Math.max(0, Math.min(1, progress))
      const totalSegments = deliveryRoute.length - 1
      const segmentExact = clamped * totalSegments
      const index = Math.min(Math.floor(segmentExact), totalSegments - 1)
      const fraction = segmentExact - index

      const p1 = deliveryRoute[index]
      const p2 = deliveryRoute[index + 1]

      const lat = p1[0] + (p2[0] - p1[0]) * fraction
      const lng = p1[1] + (p2[1] - p1[1]) * fraction
      const heading = getBearing(p1[0], p1[1], p2[0], p2[1])

      return { pos: [lat, lng], heading, segmentIndex: index }
    },
    [deliveryRoute]
  )

  // Simulation loop: Smooth 60fps movement interpolation
  const animationFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (mode !== 'simulation' || !isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      return
    }

    const durationSeconds = 45 / simSpeed // Total seconds to complete route
    let progress = routeProgress

    const step = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const deltaTime = (timestamp - lastTimeRef.current) / 1000
      lastTimeRef.current = timestamp

      // Increment progress
      progress += deltaTime / durationSeconds

      if (progress >= 1) {
        // Loop or finish
        progress = 0 // loop for continuous delivery tracking demo
        setTraveledPath([])
      }

      setRouteProgress(progress)
      const { pos, heading } = getPositionAtProgress(progress)
      setCurrentPos(pos)
      setCurrentHeading(heading)

      // Dynamic speed simulation (slow down at corners, 25-45 km/h on straights)
      const speedVariation = 32 + Math.sin(progress * Math.PI * 6) * 10
      setCurrentSpeed(Math.max(18, speedVariation))

      // Update traveled breadcrumbs trail
      setTraveledPath((prev) => {
        if (prev.length === 0) return [deliveryRoute[0], pos]
        const last = prev[prev.length - 1]
        const dist = Math.hypot(last[0] - pos[0], last[1] - pos[1])
        if (dist > 0.00015) {
          return [...prev, pos]
        }
        return prev
      })

      animationFrameRef.current = requestAnimationFrame(step)
    }

    animationFrameRef.current = requestAnimationFrame(step)

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      lastTimeRef.current = null
    }
  }, [mode, isPlaying, simSpeed, getPositionAtProgress, deliveryRoute])

  // When in Live Hardware mode, follow authentic device GPS packets
  useEffect(() => {
    if (mode === 'hardware' && device.gps?.latitude && device.gps?.longitude) {
      const livePos: [number, number] = [device.gps.latitude, device.gps.longitude]
      setCurrentPos(livePos)
      setCurrentHeading(device.gps.heading || 0)
      setCurrentSpeed(device.gps.speed || 0)

      setTraveledPath((prev) => {
        if (prev.length === 0) return [livePos]
        const last = prev[prev.length - 1]
        const dist = Math.hypot(last[0] - livePos[0], last[1] - livePos[1])
        if (dist > 0.00005) {
          return [...prev, livePos]
        }
        return prev
      })
    }
  }, [mode, device.gps?.latitude, device.gps?.longitude, device.gps?.heading, device.gps?.speed])

  // Remaining path from current position to customer destination
  const remainingPath = useMemo<[number, number][]>(() => {
    if (mode === 'hardware') {
      return [currentPos, customerLocation]
    }
    const currentSegmentIndex = Math.min(
      Math.floor(routeProgress * (deliveryRoute.length - 1)),
      deliveryRoute.length - 2
    )
    return [currentPos, ...deliveryRoute.slice(currentSegmentIndex + 1)]
  }, [mode, currentPos, customerLocation, routeProgress, deliveryRoute])

  // Dynamic ETA & Distance calculation
  const remainingDistanceKm = useMemo(() => {
    let d = 0
    for (let i = 0; i < remainingPath.length - 1; i++) {
      d += getDistanceKm(
        remainingPath[i][0],
        remainingPath[i][1],
        remainingPath[i + 1][0],
        remainingPath[i + 1][1]
      )
    }
    return Math.max(0.05, d)
  }, [remainingPath])

  const etaMinutes = useMemo(() => {
    const avgSpeed = currentSpeed > 5 ? currentSpeed : 30
    const timeHours = remainingDistanceKm / avgSpeed
    return Math.max(1, Math.round(timeHours * 60))
  }, [remainingDistanceKm, currentSpeed])

  const activeLayerConfig = MAP_LAYERS[selectedLayer] || MAP_LAYERS['google-streets']

  // Marker icons
  const deliveryBoyIcon = useMemo(() => {
    return createDeliveryBoyMarker(currentHeading, currentSpeed, 'WEGW Partner')
  }, [currentHeading, currentSpeed])

  const storeIcon = useMemo(() => {
    return createStoreMarker('Cloud Kitchen & Hub')
  }, [])

  const customerIcon = useMemo(() => {
    return createCustomerDestinationMarker('Phase 9, Mohali')
  }, [])

  const handleLayerChange = (layer: MapLayerType) => {
    setSelectedLayer(layer)
    if (onLayerChange) onLayerChange(layer)
  }

  return (
    <div className="relative h-[calc(100vh-170px)] w-full overflow-hidden rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800">
      {/* Top Floating Swiggy/Zomato-style Order Status Banner */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: Live Order Tracking Pill */}
        <div className="pointer-events-auto flex items-center gap-2">
          <Card padding="sm" className="shadow-2xl backdrop-blur-md bg-white/95 dark:bg-slate-900/95 border-orange-500/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg">
                <span className="text-xl">🛵</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Out for Delivery
                  </span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5 text-orange-500" />
                  <span className="font-extrabold text-orange-600 dark:text-orange-400">
                    Arriving in {etaMinutes} mins
                  </span>
                  <span>•</span>
                  <span>{remainingDistanceKm.toFixed(1)} km away</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Simulation Controls & Map Layer Switcher */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Back to Fleet Map (if available) */}
          {onSwitchToFleet && (
            <button
              onClick={onSwitchToFleet}
              className="flex items-center gap-1.5 rounded-xl bg-white/95 dark:bg-slate-900/95 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-lg backdrop-blur-md border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Switch to Fleet Overview Map"
            >
              <MapPin className="h-3.5 w-3.5 text-blue-500" />
              <span>Fleet Map</span>
            </button>
          )}

          {/* Mode Switcher */}
          <div className="flex items-center rounded-xl bg-white/95 dark:bg-slate-900/95 p-1 shadow-lg backdrop-blur-md border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => {
                setMode('simulation')
                setIsPlaying(true)
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                mode === 'simulation'
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Live Run Demo</span>
            </button>
            <button
              onClick={() => {
                setMode('hardware')
                setIsPlaying(false)
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                mode === 'hardware'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Radio className="h-3.5 w-3.5" />
              <span>Real Hardware MQTT</span>
            </button>
          </div>

          <MapLayerSwitcher currentLayer={selectedLayer} onLayerChange={handleLayerChange} />
        </div>
      </div>

      {/* Main Map Canvas */}
      <MapContainer
        center={currentPos}
        zoom={15}
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

        {/* Camera auto-pan to keep delivery boy in view */}
        <MapCameraFollow position={currentPos} isFollowing={isFollowing} />

        {/* 1. Traveled Breadcrumb Trail (Vibrant Solid Emerald Green with Glow) */}
        {traveledPath.length > 1 && (
          <Polyline
            positions={traveledPath}
            pathOptions={{
              color: '#10b981',
              weight: 6,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* 2. Remaining Route Path Ahead (Dashed Electric Indigo) */}
        {remainingPath.length > 1 && (
          <Polyline
            positions={remainingPath}
            pathOptions={{
              color: '#6366f1',
              weight: 5,
              opacity: 0.8,
              dashArray: '8, 10',
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Store / Hub Marker */}
        <Marker position={storeLocation} icon={storeIcon}>
          <Popup>
            <div className="p-1 text-xs">
              <p className="font-bold text-blue-600">🏪 Dispatch Store & Kitchen</p>
              <p className="text-slate-500">Order picked up and packed</p>
            </div>
          </Popup>
        </Marker>

        {/* Customer Destination Marker */}
        <Marker position={customerLocation} icon={customerIcon}>
          <Popup>
            <div className="p-1 text-xs">
              <p className="font-bold text-rose-600">📍 Customer Drop Address</p>
              <p className="text-slate-500">Tower B, Phase 9, Mohali</p>
              <p className="mt-1 font-semibold text-emerald-600">ETA: ~{etaMinutes} mins</p>
            </div>
          </Popup>
        </Marker>

        {/* Live Delivery Boy Marker */}
        <Marker position={currentPos} icon={deliveryBoyIcon} zIndexOffset={1000}>
          <Popup>
            <div className="min-w-[200px] p-1 font-sans">
              <div className="flex items-center justify-between border-b pb-1.5">
                <span className="font-bold text-sm text-orange-600">🛵 Delivery Partner</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  ON THE WAY
                </span>
              </div>
              <div className="mt-2 space-y-1 text-xs text-slate-600">
                <p>⚡ <strong>Speed:</strong> {currentSpeed.toFixed(1)} km/h</p>
                <p>🧭 <strong>Heading:</strong> {Math.round(currentHeading)}°</p>
                <p>📍 <strong>Lat/Lng:</strong> {currentPos[0].toFixed(5)}, {currentPos[1].toFixed(5)}</p>
                <p>📦 <strong>Distance Left:</strong> {remainingDistanceKm.toFixed(1)} km</p>
              </div>
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Floating Bottom Delivery HUD (Swiggy / Zomato order card) */}
      <div className="absolute bottom-4 left-4 right-4 sm:left-4 sm:right-auto sm:max-w-md z-[1000]">
        <Card padding="md" className="shadow-2xl border-orange-500/30 backdrop-blur-md bg-white/95 dark:bg-slate-900/95">
          {/* Top Bar: Driver Info & Follow Switch */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 p-0.5 shadow-md">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-900 text-white font-extrabold text-sm">
                    🛵
                  </div>
                </div>
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500"></span>
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-1.5">
                  <span>WEGW Delivery Partner</span>
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                </h4>
                <p className="font-mono text-[11px] text-slate-500">
                  Tracker: {device.deviceId}
                </p>
              </div>
            </div>

            {/* Follow Rider Button */}
            <button
              onClick={() => setIsFollowing(!isFollowing)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-xs transition ${
                isFollowing
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
              title="Auto-center map on moving delivery partner"
            >
              <Crosshair className={`h-3.5 w-3.5 ${isFollowing ? 'animate-spin' : ''}`} />
              <span>{isFollowing ? 'Tracking' : 'Track'}</span>
            </button>
          </div>

          {/* Delivery Progress Milestones */}
          <div className="mt-3">
            <div className="relative flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Placed
              </span>
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Dispatched
              </span>
              <span className="text-orange-600 flex items-center gap-1 font-extrabold">
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-ping"></span> On Way
              </span>
              <span className="text-slate-400">Arrived</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-orange-500 transition-all duration-300"
                style={{ width: `${Math.round(routeProgress * 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Live Telemetry Grid */}
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
              <p className="text-[10px] uppercase font-bold text-slate-400">Speed</p>
              <p className="text-sm font-extrabold text-orange-600 dark:text-orange-400">
                {currentSpeed.toFixed(1)} <span className="text-[10px] font-normal">km/h</span>
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
              <p className="text-[10px] uppercase font-bold text-slate-400">Heading</p>
              <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                {Math.round(currentHeading)}°
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
              <p className="text-[10px] uppercase font-bold text-slate-400">Distance Left</p>
              <p className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                {remainingDistanceKm.toFixed(1)} <span className="text-[10px] font-normal">km</span>
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800/60">
              <p className="text-[10px] uppercase font-bold text-slate-400">Battery</p>
              <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                {device.power?.batteryPercentage || 100}%
              </p>
            </div>
          </div>

          {/* Simulation Playback Bar (When simulation mode is active) */}
          {mode === 'simulation' && (
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-800">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex items-center gap-1 rounded-md bg-orange-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition"
                >
                  {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  onClick={() => {
                    setRouteProgress(0)
                    setTraveledPath([])
                  }}
                  className="rounded-md border border-slate-200 p-1 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
                  title="Reset route"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Speed Multiplier */}
              <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                <span>Speed:</span>
                {[1, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setSimSpeed(spd)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      simSpeed === spd
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'hover:bg-slate-100 text-slate-600 dark:hover:bg-slate-800'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
