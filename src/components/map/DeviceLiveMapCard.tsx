import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import { Navigation, Gauge, Compass, Satellite, MapPin, Sparkles } from 'lucide-react'
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
}

export function DeviceLiveMapCard({ device }: DeviceLiveMapCardProps) {
  const navigate = useNavigate()
  const [currentLayer, setCurrentLayer] = useState<MapLayerType>('google-streets')

  const hasGps = device.gps && device.gps.latitude !== 0 && device.gps.longitude !== 0
  const moving = isDeviceMoving(device)
  const pos: [number, number] = hasGps
    ? [device.gps.latitude, device.gps.longitude]
    : [30.704649, 76.717873]

  const activeLayerConfig = MAP_LAYERS[currentLayer] || MAP_LAYERS['google-streets']

  const markerIcon = useMemo(() => {
    if (!hasGps) return undefined
    if (moving) {
      return createMovingVehicleMarker(device.gps.heading, device.gps.speed, device.deviceName)
    }
    return createStationaryMarker(device.status, device.lock?.lockStatus)
  }, [hasGps, moving, device.gps.heading, device.gps.speed, device.deviceName, device.status, device.lock?.lockStatus])

  if (!hasGps) {
    return (
      <div className="flex h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-900/50">
        <MapPin className="h-8 w-8 text-slate-400 mb-2" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          No GPS Coordinates
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Awaiting GPS satellite fix from device modem
        </p>
      </div>
    )
  }

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-800">
      {/* Top Layer Switcher */}
      <div className="absolute top-2.5 right-2.5 z-[1000]">
        <MapLayerSwitcher currentLayer={currentLayer} onLayerChange={setCurrentLayer} />
      </div>

      {/* Top Left Status Badge & Delivery Button */}
      <div className="absolute top-2.5 left-2.5 z-[1000] flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-900/85 px-2.5 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur-xs">
          <span
            className={`h-2 w-2 rounded-full ${
              moving ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'
            }`}
          />
          <span>{moving ? 'LIVE MOVING' : 'STATIONARY'}</span>
          {moving && <span>• {device.gps.speed.toFixed(1)} km/h</span>}
        </div>
        <button
          onClick={() => navigate(`/map?view=delivery&deviceId=${device.deviceId}`)}
          className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 px-2 py-1 text-[11px] font-bold text-white shadow-md hover:from-orange-600 hover:to-amber-700 transition"
          title="Open real-time delivery boy animation & road plotting"
        >
          <span>🛵 Delivery View</span>
        </button>
      </div>

      <MapContainer
        key={`${pos[0]}-${pos[1]}`}
        center={pos}
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

        {markerIcon && (
          <Marker position={pos} icon={markerIcon}>
            <Popup>
              <div className="text-xs p-1">
                <p className="font-bold">{device.deviceName}</p>
                <p className="text-slate-500 font-mono">{device.deviceId}</p>
                <p className="mt-1 font-semibold text-emerald-600">
                  {moving ? `Moving: ${device.gps.speed.toFixed(1)} km/h` : 'Parked'}
                </p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Bottom Floating Telemetry Overlay */}
      <div className="absolute bottom-2 left-2 right-2 z-[1000] flex items-center justify-between rounded-lg bg-slate-900/90 px-3 py-1.5 text-[11px] font-medium text-slate-200 shadow-md backdrop-blur-xs">
        <span className="flex items-center gap-1 font-mono">
          <Compass className="h-3.5 w-3.5 text-blue-400" />
          {Math.round(device.gps.heading)}°
        </span>
        <span className="flex items-center gap-1">
          <Satellite className="h-3.5 w-3.5 text-amber-400" />
          {device.gps.satellites} Sats
        </span>
        <span className="font-mono text-emerald-300">
          {device.gps.latitude.toFixed(5)}, {device.gps.longitude.toFixed(5)}
        </span>
      </div>
    </div>
  )
}
