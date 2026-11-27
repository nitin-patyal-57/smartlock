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
 * Creates an animated Delivery Boy / Scooter Marker (Swiggy / Zomato / Uber Eats style)
 * Rotates smoothly to vehicle heading, pulses with delivery radar rings, and shows live speed.
 */
export function createDeliveryBoyMarker(heading: number, speed: number, agentName = 'Delivery Partner') {
  const rotation = Math.round(heading || 0)
  const speedLabel = speed > 0 ? `${speed.toFixed(1)} km/h` : 'Stopped'
  const isMoving = speed > 1.5

  return divIcon({
    className: 'custom-delivery-marker',
    html: `
      <div style="position:relative; width:54px; height:54px; display:flex; align-items:center; justify-content:center;">
        <!-- Pulsing Delivery Aura -->
        <div class="${isMoving ? 'delivery-radar-pulse-green' : 'delivery-radar-pulse'}"></div>

        <!-- Rotating Scooter / Rider Circle -->
        <div class="delivery-scooter-wrapper" style="transform: rotate(${rotation}deg); width:42px; height:42px; border-radius:50%; background:linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%); border:3px solid #ffffff; box-shadow:0 4px 14px rgba(234, 88, 12, 0.6); display:flex; align-items:center; justify-content:center; z-index:2;">
          <!-- Delivery Scooter SVG Icon -->
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));">
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="18" r="3"/>
            <path d="M6 15h7l2-5h3"/>
            <path d="M11 9l-2-4H5"/>
            <circle cx="11" cy="4" r="1.5" fill="#ffffff"/>
            <path d="M14 18h-4"/>
          </svg>
        </div>

        <!-- Direction Arrow Indicator on Top Edge -->
        <div style="position:absolute; width:10px; height:10px; transform: rotate(${rotation}deg) translateY(-24px); z-index:3;">
          <div style="width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-bottom:8px solid #10b981; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));"></div>
        </div>

        <!-- Top Floating Status Pill -->
        <div style="position:absolute; top:-22px; left:50%; transform:translateX(-50%); background:#0f172a; color:#fdba74; font-weight:800; font-size:10px; padding:2.5px 8px; border-radius:9999px; border:1px solid #f97316; white-space:nowrap; box-shadow:0 3px 8px rgba(0,0,0,0.45); letter-spacing:0.2px; z-index:4; display:flex; align-items:center; gap:4px;">
          <span>🛵</span>
          <span>${speedLabel}</span>
        </div>
      </div>
    `,
    iconSize: [54, 54],
    iconAnchor: [27, 27],
    popupAnchor: [0, -27],
  })
}

/**
 * Creates a Store / Pickup Hub marker (e.g. Restaurant, Warehouse, Origin)
 */
export function createStoreMarker(storeName = 'Store / Dispatch Hub') {
  return divIcon({
    className: 'custom-store-marker',
    html: `
      <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
        <div style="width:34px; height:34px; border-radius:10px; background:linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border:3px solid #ffffff; box-shadow:0 3px 12px rgba(29, 78, 216, 0.45); display:flex; align-items:center; justify-content:center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div style="position:absolute; bottom:-18px; left:50%; transform:translateX(-50%); background:#0f172a; color:#93c5fd; font-size:9.5px; font-weight:700; padding:1.5px 6px; border-radius:6px; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.35); border:1px solid #3b82f6;">
          🏪 ${storeName}
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  })
}

/**
 * Creates a Customer Drop-off Destination Marker
 */
export function createCustomerDestinationMarker(address = 'Delivery Address') {
  return divIcon({
    className: 'custom-customer-marker',
    html: `
      <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
        <div class="customer-drop-pulse"></div>
        <div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); border:3px solid #ffffff; box-shadow:0 3px 12px rgba(185, 28, 28, 0.5); display:flex; align-items:center; justify-content:center; z-index:2;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#ffffff">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
        <div style="position:absolute; bottom:-18px; left:50%; transform:translateX(-50%); background:#0f172a; color:#fca5a5; font-size:9.5px; font-weight:700; padding:1.5px 6px; border-radius:6px; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.35); border:1px solid #ef4444;">
          📍 ${address}
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  })
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
  status?: string;
  lastSeen?: string;
  gps?: { speed?: number };
  accelerometer?: { motion?: boolean };
  trip?: { vehicleStatus?: string };
}): boolean {
  if (!device) return false
  if (device.status === 'offline') return false
  const speed = device.gps?.speed || 0
  const motion = Boolean(device.accelerometer?.motion)
  const tripMoving = device.trip?.vehicleStatus === 'moving'
  return speed > 1.5 || motion || tripMoving
}
