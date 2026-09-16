const { initializeApp } = require('firebase/app')
const { getDatabase, ref, set, push } = require('firebase/database')

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBJYT8vhGKOrlzIk0z81VfEuUG_BMqE3a8",
  authDomain: "smart-lock-94ceb.firebaseapp.com",
  databaseURL: "https://smart-lock-94ceb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-lock-94ceb",
  storageBucket: "smart-lock-94ceb.firebasestorage.app",
  messagingSenderId: "601872708863",
  appId: "1:601872708863:web:c50ea1be512439dd64c8ca"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

const BASE_INTERVAL = process.argv.includes('--interval')
  ? parseInt(process.argv[process.argv.indexOf('--interval') + 1])
  : 2000

// 8 simulated devices
const devices = [
  {
    id: 'SL-001', name: 'Front Gate Lock', model: 'SL-PRO-200',
    lat: 39.7684, lng: -86.1581, battery: 89, online: true, locked: true,
    operator: 'T-Mobile', network: 'LTE-M'
  },
  {
    id: 'SL-002', name: 'Warehouse Side Door', model: 'SL-STD-100',
    lat: 39.7321, lng: -86.1163, battery: 67, online: true, locked: true,
    operator: 'AT&T', network: 'LTE-M'
  },
  {
    id: 'SL-003', name: 'Parking Garage Gate', model: 'SL-PRO-200',
    lat: 39.7817, lng: -86.1623, battery: 23, online: true, locked: false,
    operator: 'Verizon', network: 'NB-IoT'
  },
  {
    id: 'SL-004', name: 'Office Main Entrance', model: 'SL-PRO-300',
    lat: 39.7632, lng: -86.1489, battery: 78, online: true, locked: true,
    operator: 'T-Mobile', network: 'LTE-M'
  },
  {
    id: 'SL-005', name: 'Delivery Loading Dock', model: 'SL-STD-100',
    lat: 39.7456, lng: -86.1734, battery: 5, online: false, locked: false,
    operator: 'AT&T', network: '2G'
  },
  {
    id: 'SL-006', name: 'Perimeter Gate East', model: 'SL-PRO-200',
    lat: 39.7589, lng: -86.1345, battery: 45, online: true, locked: false,
    operator: 'T-Mobile', network: 'LTE-M', moving: true
  },
  {
    id: 'SL-007', name: 'Back Service Door', model: 'SL-STD-100',
    lat: 39.7745, lng: -86.1567, battery: 12, online: false, locked: true,
    operator: 'Verizon', network: '2G'
  },
  {
    id: 'SL-008', name: 'Emergency Exit South', model: 'SL-PRO-300',
    lat: 39.7501, lng: -86.1412, battery: 100, online: true, locked: true,
    operator: 'T-Mobile', network: 'LTE-M', externalPower: true
  }
]

function buildTelemetry(device) {
  const latOffset = (Math.random() - 0.5) * 0.0002
  const lngOffset = (Math.random() - 0.5) * 0.0002
  
  if (!device.externalPower) {
    device.battery = Math.max(1, device.battery - Math.random() * 0.3)
  }
  if (Math.random() > 0.95) {
    device.battery = Math.min(100, device.battery + 5)
  }
  if (Math.random() > 0.995) {
    device.online = !device.online
  }
  if (Math.random() > 0.98) {
    device.locked = !device.locked
  }

  const tamper = Math.random() > 0.998
  const now = new Date().toISOString()

  return {
    deviceId: device.id,
    deviceName: device.name,
    status: device.online ? 'online' : 'offline',
    lastSeen: now,
    device: {
      imei: `3569380${device.id.slice(-3)}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      modelId: device.model,
      serialNumber: `SN-${device.id}-2024`,
      appVersion: '2.4.1',
      sdkVersion: '1.8.3',
      hardwareVersion: 'HW3.2',
      bootReason: 'power_on',
      uptime: Math.floor(Date.now() / 1000) - 100000
    },
    power: {
      batteryVoltage: 3.0 + (device.battery / 100) * 1.2,
      batteryPercentage: Math.round(device.battery),
      isCharging: device.externalPower || Math.random() > 0.9,
      isUsbConnected: device.externalPower || false,
      isExternalPower: device.externalPower || false,
      isLowBattery: device.battery < 20
    },
    cellular: {
      operator: device.operator,
      networkType: device.network,
      rssi: -60 - Math.floor(Math.random() * 40),
      signalQuality: 50 + Math.floor(Math.random() * 50),
      ip: `10.24.36.${Math.floor(Math.random() * 255)}`
    },
    gps: {
      isFixed: device.online,
      latitude: device.lat + latOffset,
      longitude: device.lng + lngOffset,
      altitude: 215 + Math.floor(Math.random() * 10),
      speed: device.moving ? 10 + Math.random() * 30 : 0,
      heading: device.moving ? Math.random() * 360 : 0,
      satellites: device.online ? 8 + Math.floor(Math.random() * 6) : 0,
      hdop: 1.0 + Math.random() * 2,
      accuracy: 3 + Math.random() * 10,
      lastFix: now,
      lastLocation: 'Indianapolis, IN'
    },
    lock: {
      lockStatus: device.locked,
      doorStatus: !device.locked,
      motorStatus: device.locked ? 'idle' : 'running',
      motorCurrent: device.locked ? 0 : 120,
      positionSensor: true,
      lastLockTime: device.locked ? new Date(Date.now() - 3600000).toISOString() : now,
      lastUnlockTime: device.locked ? now : new Date(Date.now() - 3600000).toISOString(),
      unlockMethod: ['keypad', 'bluetooth', 'nfc', 'remote'][Math.floor(Math.random() * 4)],
      unlockCount: 50 + Math.floor(Math.random() * 100),
      failedUnlockCount: Math.floor(Math.random() * 3)
    },
    access: {
      keypad: { enabled: true, lastUsed: new Date(Date.now() - 7200000).toISOString(), count: Math.floor(Math.random() * 50) },
      nfc: { enabled: Math.random() > 0.3, lastUsed: new Date(Date.now() - 86400000).toISOString(), count: Math.floor(Math.random() * 20) },
      bluetooth: { enabled: true, lastUsed: new Date(Date.now() - 43200000).toISOString(), count: Math.floor(Math.random() * 30) },
      remote: { enabled: true, lastUsed: new Date(Date.now() - 1800000).toISOString(), count: Math.floor(Math.random() * 10) }
    },
    tamper: {
      tamperStatus: tamper,
      caseOpen: tamper && Math.random() > 0.5,
      wireCut: false,
      lockBreak: false,
      abnormalVibration: tamper,
      forcedUnlock: tamper && Math.random() > 0.7,
      tamperCount: tamper ? 1 : 0,
      lastTamperTime: tamper ? now : ''
    },
    accelerometer: {
      motion: device.moving || Math.random() > 0.7,
      x: (Math.random() - 0.5) * 0.5,
      y: (Math.random() - 0.5) * 0.5,
      z: 9.7 + (Math.random() - 0.5) * 0.3,
      harshBraking: Math.random() > 0.98,
      harshAcceleration: Math.random() > 0.98,
      sharpTurn: Math.random() > 0.97,
      impactCount: 0,
      drivingScore: 80 + Math.floor(Math.random() * 20)
    },
    trip: {
      vehicleStatus: device.moving ? 'moving' : 'stationary',
      tripStatus: device.moving,
      tripId: device.moving ? `TRIP-${Date.now()}` : '',
      distance: device.moving ? Math.round(Math.random() * 50 * 10) / 10 : 0,
      maximumSpeed: device.moving ? Math.round(30 + Math.random() * 30) : 0,
      overspeedCount: Math.random() > 0.95 ? 1 : 0
    },
    geofence: {
      status: 'inside',
      geofenceId: 'GF-INDY-001',
      violation: tamper && Math.random() > 0.7,
      lastEvent: new Date(Date.now() - 86400000).toISOString()
    },
    sensors: {
      temperature: 70 + Math.round(Math.random() * 15),
      internalTemperature: 80 + Math.round(Math.random() * 10),
      humidity: 40 + Math.floor(Math.random() * 30),
      hardwareSensorStatus: true
    },
    security: {
      deviceBinding: true,
      vehicleId: `VH-2024-${device.id.slice(-3)}`,
      customerId: `CUST-${1000 + parseInt(device.id.slice(-3))}`,
      certificateStatus: true,
      secureBoot: true,
      firmwareSignature: true
    },
    memory: {
      totalStorage: 16384,
      usedStorage: 2048 + Math.floor(Math.random() * 4096),
      freeStorage: 10240 - Math.floor(Math.random() * 4096)
    },
    diagnostics: {
      lastDiagnosticTime: new Date(Date.now() - 1800000).toISOString(),
      errorCodes: tamper ? ['TAMPER_001'] : [],
      systemHealth: tamper ? 'critical' : device.battery < 20 ? 'warning' : 'good'
    },
    rtc: {
      rtcTime: now,
      rtcSynced: true
    }
  }
}

async function sendToFirebase(device) {
  const data = buildTelemetry(device)
  
  try {
    // Save latest device state
    await set(ref(db, `smartlock/devices/${device.id}`), {
      deviceId: device.id,
      deviceName: device.name,
      status: data.status,
      lastSeen: data.lastSeen,
      data: data,
      updatedAt: data.lastSeen
    })
    
    // Save to history (GPS + battery snapshot)
    await push(ref(db, `smartlock/history/${device.id}`), {
      latitude: data.gps.latitude,
      longitude: data.gps.longitude,
      altitude: data.gps.altitude,
      speed: data.gps.speed,
      heading: data.gps.heading,
      accuracy: data.gps.accuracy,
      batteryPercentage: data.power.batteryPercentage,
      batteryVoltage: data.power.batteryVoltage,
      lockStatus: data.lock.lockStatus,
      doorStatus: data.lock.doorStatus,
      signalQuality: data.cellular.signalQuality,
      rssi: data.cellular.rssi,
      timestamp: data.lastSeen
    })
    
    // Auto-generate alerts
    if (data.power.batteryPercentage < 20) {
      await push(ref(db, 'smartlock/alerts'), {
        id: `alert-${Date.now()}-${device.id}`,
        deviceId: device.id,
        type: 'low_battery',
        message: `Low battery: ${data.power.batteryPercentage}% on ${device.name}`,
        severity: data.power.batteryPercentage < 10 ? 'critical' : 'warning',
        timestamp: data.lastSeen,
        acknowledged: false
      })
    }
    
    if (data.tamper.tamperStatus) {
      await push(ref(db, 'smartlock/alerts'), {
        id: `alert-${Date.now()}-${device.id}-tamper`,
        deviceId: device.id,
        type: 'tamper_detected',
        message: `Tamper alert on ${device.name}`,
        severity: 'critical',
        timestamp: data.lastSeen,
        acknowledged: false
      })
    }
    
    // Log lock/unlock activity
    await push(ref(db, 'smartlock/activity'), {
      id: `event-${Date.now()}-${device.id}`,
      deviceId: device.id,
      type: data.lock.lockStatus ? 'lock' : 'unlock',
      message: `${device.name} ${data.lock.lockStatus ? 'locked' : 'unlocked'} via ${data.lock.unlockMethod}`,
      timestamp: data.lastSeen,
      metadata: { method: data.lock.unlockMethod }
    })
    
    const status = device.online ? '🟢' : '🔴'
    const battery = `${Math.round(device.battery)}%`
    const lock = device.locked ? '🔒' : '🔓'
    console.log(`${status} ${device.id} (${device.name}) | Battery: ${battery} | ${lock} | Sent at ${new Date().toLocaleTimeString()}`)
    
  } catch (error) {
    console.error(`❌ ${device.id} - Error:`, error.message)
  }
}

console.log('Smart Lock Device Simulator Starting...')
console.log(`Firebase: ${firebaseConfig.databaseURL}`)
console.log(`Devices: ${devices.length}`)
console.log(`Interval: ${BASE_INTERVAL}ms`)
console.log('---')

// Start sending data for each device with staggered intervals
devices.forEach((device, index) => {
  const interval = BASE_INTERVAL + (index * 300) + Math.random() * 1000
  
  setTimeout(() => {
    sendToFirebase(device)
    setInterval(() => sendToFirebase(device), interval)
  }, index * 500)
})

console.log('Simulator running. Press Ctrl+C to stop.')
