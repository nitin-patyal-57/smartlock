import mqtt from 'mqtt'
import { getDb } from './database'
import { MQTT_CA, MQTT_CERT, MQTT_KEY } from './mqttCerts'

const AWS_IOT_ENDPOINT = process.env.MQTT_BROKER_URL || 'mqtts://avj249ldc7joq-ats.iot.ap-south-1.amazonaws.com:8883'

// Topics as per WEGW Tracker - MQTT Interface specification (2026-11-23)
const TOPIC_SOUNDBOX_METRICS = 'soundbox_dev/+/metrics'
const TOPIC_SOUNDBOX_ACK = 'soundbox_dev/+/ack'
const TOPIC_SOUNDBOX_CMD_PREFIX = 'soundbox_dev/'

// Legacy / diagnostic GNSS tool topics
const TOPIC_LEGACY_GPS_UPLINK = 'wegw/+/gps/nmea'
const TOPIC_LEGACY_GPS_CMD_PREFIX = 'wegw/'

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

function parseNum(v: any, fallback = 0): number {
  if (v === '' || v === undefined || v === null) return fallback
  const n = Number(v)
  return isNaN(n) ? fallback : n
}

function parseBool(v: any): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v === 1
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim()
    return s === 'y' || s === 'yes' || s === 'true' || s === '1' || s === 'fixed'
  }
  return false
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
 * Parses NMEA sentence payload (legacy / diagnostic)
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
    const cleanLine = line.split('*')[0]
    const parts = cleanLine.split(',')
    const sentenceType = parts[0].substring(3)

    if (sentenceType === 'GGA') {
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
      const status = parts[2]
      if (status === 'A') rmcValid = true
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
        speed = parseFloat((speedKnots * 1.852).toFixed(2))
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
 * Parses WEGW Tracker JSON metrics message (soundbox_dev/{imei}/metrics)
 * Any field the device cannot fill is sent as an empty string "", even numbers.
 */
function parseSoundboxMetrics(json: any, imei: string, now: string): any {
  const g = json.gps || {}
  const lat = parseNum(g.latitude, 0)
  const lon = parseNum(g.longitude, 0)
  const isFixed = g.status === 'FIXED' || (lat !== 0 && lon !== 0)

  const gps: ParsedGpsData = {
    isFixed,
    latitude: lat,
    longitude: lon,
    altitude: parseNum(g.altitude_m, 0),
    speed: parseNum(g.speed_kmph, 0),
    heading: parseNum(g.heading_deg, 0),
    satellites: parseNum(g.satellites, 0),
    hdop: parseNum(g.hdop, 0),
    accuracy: parseNum(g.accuracy_m, isFixed ? 4.5 : 50),
    lastFix: g.last_fix || now,
    lastLocation: g.location || (lat !== 0 ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : '')
  }

  const p = json.power || {}
  const batMv = parseNum(p.bat_v, 3950)
  const batPercentage = parseNum(p.bat_lvl, 85)
  const isLowBat = typeof p.low_battery === 'boolean' ? p.low_battery : (batMv < 3300)

  const c = json.cellular || {}
  const acc = json.accelerometer || {}
  const dev = json.device || {}

  return {
    deviceId: imei,
    deviceName: dev.model_id ? `${dev.model_id} (${imei})` : `SmartLock-${imei.slice(-4)}`,
    status: isLowBat ? 'warning' : 'online',
    lastSeen: now,
    device: {
      imei,
      modelId: dev.model_id || 'GW1NS-4',
      serialNumber: dev.serial_no || `SN-${imei.slice(-6)}`,
      appVersion: dev.app_v || 'WM_BP_2.0.8',
      sdkVersion: dev.sdk_v || 'WM_SDK_C_260702',
      hardwareVersion: dev.hw_v || 'Z636_V1',
      bootReason: dev.boot_reason || 'power on',
      uptime: parseNum(dev.uptime_sec, 0)
    },
    power: {
      batteryVoltage: parseFloat((batMv / 1000).toFixed(2)),
      batteryPercentage: batPercentage,
      isCharging: parseBool(p.charging),
      isUsbConnected: parseBool(p.usb),
      isExternalPower: parseBool(p.ext_power),
      isLowBattery: isLowBat,
      batteryMv: batMv,
      extPowerVoltage: p.ext_power_v || ''
    },
    cellular: {
      operator: c.operator || 'IND airtel',
      networkType: c.net_t || 'LTE',
      rssi: parseNum(c.rssi, 29),
      signalQuality: c.signal === 'EXCELLENT' ? 5 : c.signal === 'GOOD' ? 4 : c.signal === 'FAIR' ? 3 : 2,
      ip: c.ip4 || '172.18.222.207',
      imsi: c.imsi || '',
      mcc: c.mcc || '',
      mnc: c.mnc || '',
      cellId: c.cell_id || '',
      tac: c.tac || '',
      band: c.band || '',
      rsrp: parseNum(c.rsrp, 0),
      rsrq: parseNum(c.rsrq, 0),
      sinr: parseNum(c.sinr, 0),
      signal: c.signal || 'EXCELLENT',
      ip4: c.ip4 || '',
      ip6: c.ip6 || ''
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
      unlockMethod: 'remote',
      unlockCount: 1,
      failedUnlockCount: 0
    },
    access: {
      keypad: { enabled: true, lastUsed: now, count: 0 },
      nfc: { enabled: true, lastUsed: now, count: 0 },
      bluetooth: { enabled: true, lastUsed: now, count: 0 },
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
      status: acc.status || 'OK',
      motion: parseBool(acc.motion),
      x: parseNum(acc.x_g, 0),
      y: parseNum(acc.y_g, 0),
      z: parseNum(acc.z_g, 1),
      harshBraking: parseNum(acc.harsh_braking_count, 0) > 0,
      harshAcceleration: parseNum(acc.harsh_acceleration_count, 0) > 0,
      sharpTurn: parseNum(acc.sharp_turn_count, 0) > 0,
      harshBrakingCount: parseNum(acc.harsh_braking_count, 0),
      harshAccelerationCount: parseNum(acc.harsh_acceleration_count, 0),
      sharpTurnCount: parseNum(acc.sharp_turn_count, 0),
      impactCount: parseNum(acc.impact_count, 0),
      drivingScore: parseNum(acc.driving_score, 100)
    },
    trip: {
      vehicleStatus: parseNum(g.speed_kmph, 0) > 2 ? 'moving' : 'stationary',
      tripStatus: parseNum(g.speed_kmph, 0) > 2,
      tripId: `TRIP-${imei.slice(-4)}`,
      distance: 0,
      maximumSpeed: parseNum(g.speed_kmph, 0),
      overspeedCount: 0
    },
    geofence: {
      status: 'inside',
      geofenceId: 'GF-01',
      violation: false,
      lastEvent: 'enter'
    },
    sensors: {
      temperature: 28.0,
      internalTemperature: 31.0,
      humidity: 50,
      hardwareSensorStatus: true
    },
    security: {
      deviceBinding: true,
      vehicleId: '',
      customerId: '',
      certificateStatus: true,
      secureBoot: true,
      firmwareSignature: true
    },
    memory: {
      totalStorage: 16777216,
      usedStorage: 5242880,
      freeStorage: 11534336
    },
    diagnostics: {
      lastDiagnosticTime: now,
      errorCodes: [],
      systemHealth: 'good'
    },
    rtc: {
      rtcTime: json.rtc || now,
      rtcSynced: Boolean(json.rtc)
    }
  }
}

/**
 * Creates default device data structure matching real testing device 861185084122719.
 */
function createDefaultDevice(deviceId: string, gps: ParsedGpsData, now: string) {
  return {
    deviceId,
    deviceName: `GW1NS-4 (${deviceId})`,
    status: 'online',
    lastSeen: now,
    device: {
      imei: deviceId,
      modelId: 'GW1NS-4',
      serialNumber: `SN-${deviceId.slice(-6)}`,
      appVersion: 'WMZ_DEV_1.0.2',
      sdkVersion: 'WM_SDK_C_261008',
      hardwareVersion: 'Z636_V1',
      bootReason: 'power-off charging',
      uptime: 389
    },
    power: {
      batteryVoltage: 4.22,
      batteryPercentage: 100,
      isCharging: true,
      isUsbConnected: true,
      isExternalPower: true,
      isLowBattery: false
    },
    cellular: {
      operator: 'IND airtel',
      networkType: 'LTE',
      rssi: 29,
      signalQuality: 5,
      ip: '172.18.222.207'
    },
    gps,
    lock: {
      lockStatus: true,
      doorStatus: false,
      motorStatus: 'idle',
      motorCurrent: 0,
      positionSensor: true,
      lastLockTime: '2026-11-23T10:32:44Z',
      lastUnlockTime: '',
      unlockMethod: 'remote',
      unlockCount: 1,
      failedUnlockCount: 0
    },
    access: {
      keypad: { enabled: true, lastUsed: '', count: 0 },
      nfc: { enabled: true, lastUsed: '', count: 0 },
      bluetooth: { enabled: true, lastUsed: '', count: 0 },
      remote: { enabled: true, lastUsed: '2026-11-23T10:32:44Z', count: 1 }
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
      x: -0.008,
      y: 0.008,
      z: -1.043,
      harshBraking: false,
      harshAcceleration: false,
      sharpTurn: false,
      impactCount: 0,
      drivingScore: 100
    },
    trip: {
      vehicleStatus: 'stationary',
      tripStatus: false,
      tripId: 'TRIP-2719',
      distance: 0,
      maximumSpeed: 0,
      overspeedCount: 0
    },
    geofence: {
      status: 'inside',
      geofenceId: 'GF-01',
      violation: false,
      lastEvent: 'enter'
    },
    sensors: {
      temperature: 28.0,
      internalTemperature: 31.0,
      humidity: 50,
      hardwareSensorStatus: true
    },
    security: {
      deviceBinding: true,
      vehicleId: '',
      customerId: '',
      certificateStatus: true,
      secureBoot: true,
      firmwareSignature: true
    },
    memory: {
      totalStorage: 16777216,
      usedStorage: 5242880,
      freeStorage: 11534336
    },
    diagnostics: {
      lastDiagnosticTime: '2026-11-23T10:32:44Z',
      errorCodes: [],
      systemHealth: 'good'
    },
    rtc: {
      rtcTime: '2026-11-23T05:02:44.945Z',
      rtcSynced: true
    },
    relays: {
      '1': 'off',
      '2': 'off'
    },
    leds: {
      red: 'auto',
      green: 'auto',
      blue: 'auto'
    }
  }
}

/**
 * Handle incoming telemetry from MQTT
 */
function handleMqttMessage(topic: string, messageBuffer: Buffer) {
  try {
    const rawPayload = messageBuffer.toString('utf-8').trim()
    const now = new Date().toISOString()
    const db = getDb()

    // 1. Check for WEGW Tracker metrics: soundbox_dev/{imei}/metrics
    const metricsMatch = topic.match(/^soundbox_dev\/([^/]+)\/metrics$/)
    if (metricsMatch) {
      const imei = metricsMatch[1]
      try {
        const json = JSON.parse(rawPayload)
        const deviceData = parseSoundboxMetrics(json, imei, now)

        console.log(`[MQTT WEGW Metrics] ${imei}: Lat=${deviceData.gps.latitude}, Lon=${deviceData.gps.longitude}, Speed=${deviceData.gps.speed} km/h, Bat=${deviceData.power.batteryPercentage}%`)

        // Save in DB
        db.prepare(`
          INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(deviceId) DO UPDATE SET
            status = excluded.status,
            lastSeen = excluded.lastSeen,
            data = excluded.data,
            updatedAt = excluded.updatedAt
        `).run(imei, deviceData.deviceName, deviceData.status, now, JSON.stringify(deviceData), now)

        // Save to history
        db.prepare(`
          INSERT INTO device_history 
          (deviceId, latitude, longitude, altitude, speed, heading, accuracy, 
           batteryPercentage, batteryVoltage, lockStatus, doorStatus, signalQuality, rssi, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          imei,
          deviceData.gps.latitude,
          deviceData.gps.longitude,
          deviceData.gps.altitude,
          deviceData.gps.speed,
          deviceData.gps.heading,
          deviceData.gps.accuracy,
          deviceData.power.batteryPercentage,
          deviceData.power.batteryVoltage,
          deviceData.lock.lockStatus ? 1 : 0,
          deviceData.lock.doorStatus ? 1 : 0,
          deviceData.cellular.signalQuality,
          deviceData.cellular.rssi,
          now
        )

        // Push real-time to dashboard
        if (broadcastFn) {
          broadcastFn('device_update', {
            deviceId: imei,
            data: deviceData,
            timestamp: now
          })
        }
      } catch (e) {
        console.error(`[MQTT] Failed to parse metrics JSON from ${imei}:`, e)
      }
      return
    }

    // 2. Check for WEGW Tracker acks: soundbox_dev/{imei}/ack
    const ackMatch = topic.match(/^soundbox_dev\/([^/]+)\/ack$/)
    if (ackMatch) {
      const imei = ackMatch[1]
      try {
        const ack = JSON.parse(rawPayload)
        console.log(`[MQTT WEGW Ack] ${imei}:`, ack)

        // Update relay/lock status in existing device
        const existingRow = db.prepare('SELECT * FROM devices WHERE deviceId = ?').get(imei) as any
        if (existingRow && ack.relays) {
          const dev = JSON.parse(existingRow.data)
          // Relay 1 maps to Lock Status (on = locked, off = unlocked)
          if (ack.relays['1']) {
            dev.lock.lockStatus = (ack.relays['1'] === 'on')
          }
          dev.relays = ack.relays
          dev.leds = ack.leds

          db.prepare('UPDATE devices SET data = ?, updatedAt = ? WHERE deviceId = ?')
            .run(JSON.stringify(dev), now, imei)

          if (broadcastFn) {
            broadcastFn('device_update', { deviceId: imei, data: dev, timestamp: now })
            broadcastFn('device_ack', { deviceId: imei, ack, timestamp: now })
          }
        }
      } catch (e) {
        console.error(`[MQTT] Failed to parse ack JSON from ${imei}:`, e)
      }
      return
    }

    // 3. Check for legacy NMEA: wegw/{imei}/gps/nmea
    const legacyMatch = topic.match(/^wegw\/([^/]+)\/gps\/nmea$/)
    if (legacyMatch) {
      const imei = legacyMatch[1]
      const { gps, sentences } = parseNmeaPayload(rawPayload)

      if (broadcastFn) {
        broadcastFn('mqtt_nmea', { deviceId: imei, raw: rawPayload, sentences, timestamp: now })
      }

      if (!gps) return

      console.log(`[MQTT Legacy NMEA] ${imei}: Lat=${gps.latitude}, Lon=${gps.longitude}, Sats=${gps.satellites}`)

      const existingRow = db.prepare('SELECT * FROM devices WHERE deviceId = ?').get(imei) as any
      let deviceData: any

      if (existingRow) {
        try {
          deviceData = JSON.parse(existingRow.data)
        } catch {
          deviceData = createDefaultDevice(imei, gps, now)
        }
        deviceData.gps = { ...deviceData.gps, ...gps }
        deviceData.status = 'online'
        deviceData.lastSeen = now
      } else {
        deviceData = createDefaultDevice(imei, gps, now)
      }

      db.prepare(`
        INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(deviceId) DO UPDATE SET
          status = excluded.status,
          lastSeen = excluded.lastSeen,
          data = excluded.data,
          updatedAt = excluded.updatedAt
      `).run(imei, deviceData.deviceName, 'online', now, JSON.stringify(deviceData), now)

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

      if (broadcastFn) {
        broadcastFn('device_update', { deviceId: imei, data: deviceData, timestamp: now })
      }
    }
  } catch (error) {
    console.error('[MQTT] Error processing MQTT message:', error)
  }
}

/**
 * Seed initial device entries if not present
 */
function seedInitialDevices() {
  try {
    const db = getDb()
    // Remove stale demo devices
    try {
      db.prepare("DELETE FROM devices WHERE deviceId IN ('867509082945058', '861185084200101')").run()
    } catch {}

    const imei = '861185084122719'
    const now = new Date().toISOString()
    const defaultGps: ParsedGpsData = {
      isFixed: true,
      latitude: 30.657035,
      longitude: 76.729596,
      altitude: 301.7,
      speed: 0,
      heading: 183,
      satellites: 29,
      hdop: 0.6,
      accuracy: 2.9,
      lastFix: '2026-11-23T10:32:44Z',
      lastLocation: '30.65704, 76.72960'
    }
    const dev = createDefaultDevice(imei, defaultGps, now)
    db.prepare(`
      INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(deviceId) DO UPDATE SET
        data = excluded.data,
        status = excluded.status,
        updatedAt = excluded.updatedAt
    `).run(imei, dev.deviceName, 'online', now, JSON.stringify(dev), now)
    console.log(`[MQTT] Synced real device ${imei} baseline into database`)
  } catch (err) {
    console.error('[MQTT] Error seeding initial devices:', err)
  }
}

/**
 * Initialize MQTT Client connection to AWS IoT Core
 */
export function initMqttService(broadcast: (event: string, data: unknown) => void) {
  broadcastFn = broadcast

  seedInitialDevices()

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

      // Subscribe to WEGW Tracker production topics
      mqttClient?.subscribe([TOPIC_SOUNDBOX_METRICS, TOPIC_SOUNDBOX_ACK], { qos: 1 }, (err) => {
        if (err) console.error('[MQTT] Subscription error on soundbox_dev topics:', err)
        else console.log(`[MQTT] Subscribed to production WEGW Tracker topics: ${TOPIC_SOUNDBOX_METRICS}, ${TOPIC_SOUNDBOX_ACK}`)
      })

      // Subscribe to legacy GPS NMEA topic
      mqttClient?.subscribe(TOPIC_LEGACY_GPS_UPLINK, { qos: 0 }, (err) => {
        if (err) console.error('[MQTT] Subscription error on wegw topics:', err)
        else console.log(`[MQTT] Subscribed to legacy GNSS telemetry topic: ${TOPIC_LEGACY_GPS_UPLINK}`)
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
 * Publish Relay Command as per WEGW Tracker specification:
 * {"id": "c1", "cmd": "relay", "relay": 1, "state": "on"}
 * QoS 1, retain: false
 */
export async function publishRelayCommand(imei: string, relay: 1 | 2, state: 'on' | 'off'): Promise<boolean> {
  const id = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const payload = JSON.stringify({ id, cmd: 'relay', relay, state })
  return publishCommand(imei, payload)
}

/**
 * Publish LED Command as per WEGW Tracker specification:
 * {"id": "c2", "cmd": "led", "led": "red", "state": "blink", "duration_s": 30}
 * QoS 1, retain: false
 */
export async function publishLedCommand(
  imei: string,
  led: 'red' | 'green' | 'blue' | 'all',
  state: 'on' | 'off' | 'blink' | 'auto',
  durationS = 0
): Promise<boolean> {
  const id = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const obj: any = { id, cmd: 'led', led, state }
  if (durationS > 0) obj.duration_s = durationS
  return publishCommand(imei, JSON.stringify(obj))
}

/**
 * Publish Status Command as per WEGW Tracker specification:
 * {"id": "c4", "cmd": "status"}
 * QoS 1, retain: false
 */
export async function publishStatusCommand(imei: string): Promise<boolean> {
  const id = `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  return publishCommand(imei, JSON.stringify({ id, cmd: 'status' }))
}

/**
 * Core command publisher (retains=false, QoS=1)
 */
async function publishCommand(imei: string, jsonPayload: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!mqttClient || !mqttClient.connected) {
      console.warn('[MQTT] Cannot publish command: client is not connected')
      resolve(false)
      return
    }

    const topic = `${TOPIC_SOUNDBOX_CMD_PREFIX}${imei}/command`
    mqttClient.publish(topic, jsonPayload, { qos: 1, retain: false }, (err) => {
      if (err) {
        console.error(`[MQTT] Failed to publish command to ${topic}:`, err)
        resolve(false)
      } else {
        console.log(`[MQTT] Published command to ${topic}: ${jsonPayload}`)
        resolve(true)
      }
    })
  })
}

/**
 * Publish a legacy command (e.g. stream=1)
 */
export async function publishGpsCommand(imei: string, command: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!mqttClient || !mqttClient.connected) {
      console.warn('[MQTT] Cannot publish command: client is not connected')
      resolve(false)
      return
    }

    const topic = `${TOPIC_LEGACY_GPS_CMD_PREFIX}${imei}/gps/cmd`
    mqttClient.publish(topic, command, { qos: 1, retain: false }, (err) => {
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
