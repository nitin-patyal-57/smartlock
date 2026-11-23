import mqtt from 'mqtt'
import { getDb } from './database'
import { MQTT_CA, MQTT_CERT, MQTT_KEY } from './mqttCerts'

const AWS_IOT_ENDPOINT = process.env.MQTT_BROKER_URL || 'mqtts://avj249ldc7joq-ats.iot.ap-south-1.amazonaws.com:8883'
const TOPIC_GPS_UPLINK = 'wegw/+/gps/nmea'
const TOPIC_GPS_DOWNLINK_PREFIX = 'wegw/'

let mqttClient: mqtt.MqttClient | null = null
let broadcastFn: ((event: string, data: unknown) => void) | null = null

export interface ParsedGpsData {
  isFixed: boolean
  latitude: number
  longitude: number
  altitude: number
  speed: number
  heading: number
  satellites: number
  hdop: number
  accuracy: number
  lastFix: string
  lastLocation: string
}

/**
 * Convert NMEA coordinate string (DDMM.MMMM or DDDMM.MMMM) and direction (N/S/E/W)
 * to decimal degrees.
 */
export function parseNmeaCoord(val: string, dir: string): number {
  if (!val || !dir) return 0
  const dotIndex = val.indexOf('.')
  if (dotIndex < 2) return 0

  const degDigits = (dir === 'N' || dir === 'S') ? 2 : 3
  const degrees = parseFloat(val.substring(0, degDigits))
  const minutes = parseFloat(val.substring(degDigits))

  if (isNaN(degrees) || isNaN(minutes)) return 0

  let decimal = degrees + (minutes / 60.0)
  if (dir === 'S' || dir === 'W') {
    decimal = -decimal
  }
  return parseFloat(decimal.toFixed(6))
}

/**
 * Parses NMEA sentence payload (which may contain multiple lines of GGA, RMC, GSA, GSV)
 */
export function parseNmeaPayload(rawPayload: string): { gps: ParsedGpsData | null; sentences: string[] } {
  const lines = rawPayload
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.startsWith('$'))

  if (lines.length === 0) {
    return { gps: null, sentences: [] }
  }

  let latitude = 0
  let longitude = 0
  let altitude = 0
  let speed = 0
  let heading = 0
  let satellites = 0
  let hdop = 0
  let fixQuality = 0
  let rmcValid = false
  let hasCoord = false

  for (const line of lines) {
    const cleanLine = line.split('*')[0] // strip checksum
    const parts = cleanLine.split(',')
    const sentenceType = parts[0].substring(3) // strip talker ID (GP, GN, GA, etc.)

    if (sentenceType === 'GGA') {
      // $--GGA,time,lat,NS,lon,EW,quality,numSV,HDOP,alt,M,sep,M,diffAge,diffStation
      if (parts[2] && parts[3] && parts[4] && parts[5]) {
        latitude = parseNmeaCoord(parts[2], parts[3])
        longitude = parseNmeaCoord(parts[4], parts[5])
        if (latitude !== 0 || longitude !== 0) hasCoord = true
      }
      fixQuality = parseInt(parts[6] || '0', 10)
      satellites = parseInt(parts[7] || '0', 10)
      hdop = parseFloat(parts[8] || '0')
      altitude = parseFloat(parts[9] || '0')
    } else if (sentenceType === 'RMC') {
      // $--RMC,time,status,lat,NS,lon,EW,spdKnots,cogDeg,date,mv,mvEW,posMode
      const status = parts[2]
      if (status === 'A') {
        rmcValid = true
      }
      if (parts[3] && parts[4] && parts[5] && parts[6]) {
        const rmcLat = parseNmeaCoord(parts[3], parts[4])
        const rmcLon = parseNmeaCoord(parts[5], parts[6])
        if (rmcLat !== 0 || rmcLon !== 0) {
          latitude = rmcLat
          longitude = rmcLon
          hasCoord = true
        }
      }
      const speedKnots = parseFloat(parts[7] || '0')
      if (!isNaN(speedKnots)) {
        speed = parseFloat((speedKnots * 1.852).toFixed(2)) // convert knots to km/h
      }
      const cog = parseFloat(parts[8] || '0')
      if (!isNaN(cog)) {
        heading = parseFloat(cog.toFixed(1))
      }
    }
  }

  const isFixed = (fixQuality > 0) || rmcValid
  const accuracy = hdop > 0 ? parseFloat((hdop * 2.5).toFixed(1)) : (isFixed ? 5.0 : 50.0)
  const now = new Date().toISOString()

  if (!hasCoord && !isFixed) {
    return { gps: null, sentences: lines }
  }

  const gps: ParsedGpsData = {
    isFixed,
    latitude,
    longitude,
    altitude,
    speed,
    heading,
    satellites,
    hdop,
    accuracy,
    lastFix: now,
    lastLocation: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
  }

  return { gps, sentences: lines }
}

/**
 * Creates default fallback device data structure if device is not yet registered.
 */
function createDefaultDevice(deviceId: string, gps: ParsedGpsData, now: string) {
  return {
    deviceId,
    deviceName: `SmartLock-${deviceId.slice(-4)}`,
    status: 'online',
    lastSeen: now,
    device: {
      imei: deviceId,
      modelId: 'WM-SL-01',
      serialNumber: `SN-${deviceId.slice(-6)}`,
      appVersion: '2.1.0',
      sdkVersion: '1.4.2',
      hardwareVersion: 'Rev-B',
      bootReason: 'power_on',
      uptime: 86400
    },
    power: {
      batteryVoltage: 3.95,
      batteryPercentage: 85,
      isCharging: false,
      isUsbConnected: false,
      isExternalPower: false,
      isLowBattery: false
    },
    cellular: {
      operator: 'Airtel',
      networkType: '4G LTE',
      rssi: -72,
      signalQuality: 4,
      ip: '10.42.0.1'
    },
    gps,
    lock: {
      lockStatus: true,
      doorStatus: false,
      motorStatus: 'idle',
      motorCurrent: 0,
      positionSensor: true,
      lastLockTime: now,
      lastUnlockTime: now,
      unlockMethod: 'nfc',
      unlockCount: 12,
      failedUnlockCount: 0
    },
    access: {
      keypad: { enabled: true, lastUsed: now, count: 5 },
      nfc: { enabled: true, lastUsed: now, count: 7 },
      bluetooth: { enabled: true, lastUsed: now, count: 3 },
      remote: { enabled: true, lastUsed: now, count: 1 }
    },
    tamper: {
      tamperStatus: false,
      caseOpen: false,
      wireCut: false,
      lockBreak: false,
      abnormalVibration: false,
      forcedUnlock: false,
      tamperCount: 0,
      lastTamperTime: ''
    },
    accelerometer: {
      motion: false,
      x: 0.01,
      y: 0.02,
      z: 0.98,
      harshBraking: false,
      harshAcceleration: false,
      sharpTurn: false,
      impactCount: 0,
      drivingScore: 98
    },
    trip: {
      vehicleStatus: 'stationary',
      tripStatus: false,
      tripId: '',
      distance: 0,
      maximumSpeed: 0,
      overspeedCount: 0
    },
    geofence: {
      status: 'inside',
      geofenceId: 'GF-DEFAULT',
      violation: false,
      lastEvent: 'enter'
    },
    sensors: {
      temperature: 28.5,
      internalTemperature: 31.2,
      humidity: 55,
      hardwareSensorStatus: true
    },
    security: {
      deviceBinding: true,
      vehicleId: 'VEH-01',
      customerId: 'CUST-01',
      certificateStatus: true,
      secureBoot: true,
      firmwareSignature: true
    },
    memory: {
      totalStorage: 64000,
      usedStorage: 18200,
      freeStorage: 45800
    },
    diagnostics: {
      lastDiagnosticTime: now,
      errorCodes: [],
      systemHealth: 'good'
    },
    rtc: {
      rtcTime: now,
      rtcSynced: true
    }
  }
}

/**
 * Handle incoming telemetry from MQTT
 */
function handleMqttMessage(topic: string, messageBuffer: Buffer) {
  try {
    const rawPayload = messageBuffer.toString('utf-8')
    // Extract IMEI from topic: wegw/<imei>/gps/nmea
    const match = topic.match(/^wegw\/([^/]+)\/gps\/nmea$/)
    if (!match) return

    const imei = match[1]
    const { gps, sentences } = parseNmeaPayload(rawPayload)
    const now = new Date().toISOString()
    const db = getDb()

    // Notify listeners of raw NMEA line for real-time logs / skyplot
    if (broadcastFn) {
      broadcastFn('mqtt_nmea', {
        deviceId: imei,
        raw: rawPayload,
        sentences,
        timestamp: now
      })
    }

    if (!gps) {
      console.log(`[MQTT] Received non-fix NMEA from ${imei} (${sentences.length} lines)`)
      return
    }

    console.log(`[MQTT] GPS Fix from ${imei}: Lat=${gps.latitude}, Lon=${gps.longitude}, Sats=${gps.satellites}, Speed=${gps.speed} km/h`)

    // Check if device already exists in SQLite
    const existingRow = db.prepare('SELECT * FROM devices WHERE deviceId = ?').get(imei) as any
    let deviceData: any

    if (existingRow) {
      try {
        deviceData = JSON.parse(existingRow.data)
      } catch {
        deviceData = createDefaultDevice(imei, gps, now)
      }
      deviceData.gps = {
        ...deviceData.gps,
        ...gps
      }
      deviceData.status = 'online'
      deviceData.lastSeen = now
    } else {
      deviceData = createDefaultDevice(imei, gps, now)
    }

    const deviceName = deviceData.deviceName || `SmartLock-${imei.slice(-4)}`
    const status = 'online'

    // Update devices table
    db.prepare(`
      INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(deviceId) DO UPDATE SET
        status = excluded.status,
        lastSeen = excluded.lastSeen,
        data = excluded.data,
        updatedAt = excluded.updatedAt
    `).run(imei, deviceName, status, now, JSON.stringify(deviceData), now)

    // Insert history record
    db.prepare(`
      INSERT INTO device_history 
      (deviceId, latitude, longitude, altitude, speed, heading, accuracy, 
       batteryPercentage, batteryVoltage, lockStatus, doorStatus, signalQuality, rssi, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      imei,
      gps.latitude,
      gps.longitude,
      gps.altitude,
      gps.speed,
      gps.heading,
      gps.accuracy,
      deviceData.power?.batteryPercentage || 85,
      deviceData.power?.batteryVoltage || 3.95,
      deviceData.lock?.lockStatus ? 1 : 0,
      deviceData.lock?.doorStatus ? 1 : 0,
      deviceData.cellular?.signalQuality || 4,
      deviceData.cellular?.rssi || -70,
      now
    )

    // Broadcast updated device state to WebSocket clients
    if (broadcastFn) {
      broadcastFn('device_update', {
        deviceId: imei,
        data: deviceData,
        timestamp: now
      })
    }
  } catch (error) {
    console.error('[MQTT] Error processing MQTT message:', error)
  }
}

/**
 * Initialize MQTT Client connection to AWS IoT Core
 */
export function initMqttService(broadcast: (event: string, data: unknown) => void) {
  broadcastFn = broadcast

  if (mqttClient) {
    console.log('[MQTT] Client already initialized')
    return mqttClient
  }

  const clientId = `smartlock_server_${Math.random().toString(16).substring(2, 10)}`
  console.log(`[MQTT] Connecting to AWS IoT Core (${AWS_IOT_ENDPOINT}) with Client ID: ${clientId}`)

  try {
    mqttClient = mqtt.connect(AWS_IOT_ENDPOINT, {
      clientId,
      ca: MQTT_CA,
      cert: MQTT_CERT,
      key: MQTT_KEY,
      rejectUnauthorized: true,
      protocol: 'mqtts',
      keepalive: 60,
      reconnectPeriod: 5000,
      clean: true
    })

    mqttClient.on('connect', () => {
      console.log(`[MQTT] Connected successfully to AWS IoT Core broker!`)
      mqttClient?.subscribe(TOPIC_GPS_UPLINK, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MQTT] Failed to subscribe to ${TOPIC_GPS_UPLINK}:`, err)
        } else {
          console.log(`[MQTT] Subscribed to GPS telemetry topic: ${TOPIC_GPS_UPLINK}`)
        }
      })
    })

    mqttClient.on('message', (topic, payload) => {
      handleMqttMessage(topic, payload)
    })

    mqttClient.on('error', (err) => {
      console.error('[MQTT] Connection error:', err.message)
    })

    mqttClient.on('close', () => {
      console.log('[MQTT] Connection closed, will retry...')
    })

    mqttClient.on('offline', () => {
      console.warn('[MQTT] Client is offline')
    })
  } catch (err) {
    console.error('[MQTT] Failed to initialize client:', err)
  }

  return mqttClient
}

/**
 * Publish a command to a specific device over MQTT (e.g. stream=1, rate=1000)
 */
export async function publishGpsCommand(imei: string, command: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!mqttClient || !mqttClient.connected) {
      console.warn(`[MQTT] Cannot publish command: client is not connected`)
      resolve(false)
      return
    }

    const topic = `${TOPIC_GPS_DOWNLINK_PREFIX}${imei}/gps/cmd`
    mqttClient.publish(topic, command, { qos: 1 }, (err) => {
      if (err) {
        console.error(`[MQTT] Failed to publish command to ${topic}:`, err)
        resolve(false)
      } else {
        console.log(`[MQTT] Published command to ${topic}: "${command}"`)
        resolve(true)
      }
    })
  })
}

/**
 * Get current MQTT client status
 */
export function getMqttStatus(): { connected: boolean; broker: string } {
  return {
    connected: mqttClient ? mqttClient.connected : false,
    broker: AWS_IOT_ENDPOINT
  }
}
