import { divIcon } from 'leaflet'

export type MapLayerType =
  | 'google-streets'
  | 'google-hybrid'
  | 'google-satellite'
  | 'google-traffic'
  | 'google-terrain'
  | 'dark'
  | 'osm'

export interface MapLayerConfig {
  id: MapLayerType
  name: string
  shortName: string
  icon: string
  url: string
  subdomains?: string[]
  maxZoom: number
  attribution: string
}

export const MAP_LAYERS: Record<MapLayerType, MapLayerConfig> = {
  'google-streets': {
    id: 'google-streets',
    name: 'Google Maps (Streets)',
    shortName: 'Google Streets',
    icon: '🗺️',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a>',
  },
  'google-hybrid': {
    id: 'google-hybrid',
    name: 'Google Hybrid (Satellite + Roads)',
    shortName: 'Google Hybrid',
    icon: '🌍',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a>',
  },
  'google-satellite': {
    id: 'google-satellite',
    name: 'Google Satellite Imagery',
    shortName: 'Satellite',
    icon: '🛰️',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a>',
  },
  'google-traffic': {
    id: 'google-traffic',
    name: 'Google Live Traffic',
    shortName: 'Traffic',
    icon: '🚦',
    url: 'https://mt1.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps Traffic</a>',
  },
  'google-terrain': {
    id: 'google-terrain',
    name: 'Google Terrain',
    shortName: 'Terrain',
    icon: '⛰️',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; <a href="https://maps.google.com" target="_blank" rel="noopener">Google Maps</a>',
  },
  'dark': {
    id: 'dark',
    name: 'Dark Matter (Night View)',
    shortName: 'Dark Mode',
    icon: '🌙',
    url: 'https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  },
  'osm': {
    id: 'osm',
    name: 'OpenStreetMap',
    shortName: 'OSM',
    icon: '🌐',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
}

/**
 * Creates an animated 3D navigation arrow marker for moving devices.
 * Rotates smoothly according to device heading and pulses with a radar wave.
 */
export function createMovingVehicleMarker(heading: number, speed: number, deviceName: string) {
  const rotation = Math.round(heading || 0)
  const speedLabel = speed > 0 ? `${speed.toFixed(1)} km/h` : 'Moving'

  return divIcon({
    className: 'custom-vehicle-marker',
    html: `
      <div style="position:relative; width:48px; height:48px; display:flex; align-items:center; justify-content:center;">
        <!-- Pulsing Radar Wave Ring -->
        <div class="moving-radar-ring"></div>
        <!-- Rotating Navigation Arrow -->
        <div class="vehicle-heading-arrow" style="transform: rotate(${rotation}deg); width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg, #10b981 0%, #047857 100%); border:3px solid #ffffff; box-shadow:0 4px 12px rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; z-index:2;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
        <!-- Speed Badge Pill -->
        <div style="position:absolute; top:-20px; left:50%; transform:translateX(-50%); background:#0f172a; color:#34d399; font-weight:700; font-size:10px; padding:2px 7px; border-radius:9999px; border:1px solid #10b981; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.35); letter-spacing:0.2px; z-index:3;">
          🚗 ${speedLabel}
        </div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  })
}

/**
 * Creates a clean modern marker for stationary (parked) devices.
 */
export function createStationaryMarker(status: string, lockStatus: boolean) {
  const isOnline = status === 'online'
  const primaryColor = isOnline ? '#3b82f6' : status === 'warning' ? '#f59e0b' : '#ef4444'

  return divIcon({
    className: 'custom-stationary-marker',
    html: `
      <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
        <div style="width:28px; height:28px; border-radius:50%; background:${primaryColor}; border:3px solid #ffffff; box-shadow:0 3px 10px rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center;">
          <div style="width:8px; height:8px; border-radius:50%; background:#ffffff;"></div>
        </div>
        <div style="position:absolute; bottom:-16px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.9); color:#e2e8f0; font-size:9px; font-weight:600; padding:1px 6px; border-radius:6px; white-space:nowrap; box-shadow:0 2px 4px rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1);">
          ${lockStatus ? '🔒 Locked' : '🔓 Unlocked'}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  })
}

/**
 * Check whether a device is currently moving based on motion sensors, speed, and status.
 */
export function isDeviceMoving(device: {
  gps?: { speed?: number };
  accelerometer?: { motion?: boolean };
  trip?: { vehicleStatus?: string };
}): boolean {
  if (!device) return false
  const speed = device.gps?.speed || 0
  const motion = Boolean(device.accelerometer?.motion)
  const tripMoving = device.trip?.vehicleStatus === 'moving'
  return speed > 1.5 || motion || tripMoving
}
