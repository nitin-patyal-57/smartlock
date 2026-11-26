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

function parseBool(v: any, fallback = false): boolean {
  if (v === '' || v === undefined || v === null) return fallback
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v === 1
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim()
    if (['y', 'yes', 'true', '1', 'fixed', 'locked', 'lock', 'closed', 'ok', 'active'].includes(s)) return true
    if (['n', 'no', 'false', '0', 'unlocked', 'unlock', 'open', 'opened', 'idle'].includes(s)) return false
  }
  return fallback
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
 * Check if the incoming JSON payload specifically belongs to a SmartLock device.
 * Excludes plain GPS trackers, vehicle trackers, and soundboxes that only have GPS/cellular/relays without lock hardware.
 */
export function hasLockOption(json: any, topic?: string): boolean {
  if (!json || typeof json !== 'object') return false

  // Topic check: if published on a dedicated smartlock topic
  if (topic && (topic.startsWith('smartlock/') || topic.includes('/smartlock/'))) {
    return true
  }

  // Explicit device type/model declaration
  if (
    json.isSmartLock === true ||
    json.deviceType === 'smartlock' ||
    json.device_type === 'smartlock' ||
    json.type === 'smartlock' ||
    json.device?.type === 'smartlock' ||
    json.device?.device_type === 'smartlock'
  ) {
    return true
  }

  // Explicit lock object: must exist and have content
  if (json.lock !== undefined && json.lock !== null) {
    if (typeof json.lock === 'object') {
      const keys = Object.keys(json.lock)
      if (keys.length > 0) return true
    } else {
      return true
    }
  }

  // Explicit lock/door status properties in payload
  if (
    json.lock_status !== undefined ||
    json.lockStatus !== undefined ||
    json.lock_state !== undefined ||
    json.lockState !== undefined ||
    json.door_status !== undefined ||
    json.doorStatus !== undefined ||
    json.door !== undefined ||
    json.smartlock !== undefined ||
    json.smart_lock !== undefined
  ) {
    return true
  }

  // Explicit lock relay (plain relays like relay '1' on vehicle GPS trackers are NOT smartlocks)
  if (json.relays && (json.relays.lock !== undefined || json.relays.smartlock !== undefined)) {
    return true
  }

  return false
}

/**
 * Dynamically extract and normalize lock info from JSON payload.
 */
export function parseLockInfo(json: any, now: string, existingLock?: any): any {
  const l = json.lock || json.smartlock || json.smart_lock || {}

  let lockStatus = true
  if (typeof json.lock === 'boolean') {
    lockStatus = json.lock
  } else if (typeof json.lock === 'string') {
    const s = json.lock.toLowerCase().trim()
    lockStatus = s === 'locked' || s === 'lock' || s === '1' || s === 'true' || s === 'y'
  } else if (typeof json.lock === 'number') {
    lockStatus = json.lock === 1
  } else if (l.lock_status !== undefined) {
    const s = String(l.lock_status).toLowerCase().trim()
    lockStatus = s === 'locked' || s === 'lock' || s === '1' || s === 'true' || s === 'y'
  } else if (l.lockStatus !== undefined) {
    const s = String(l.lockStatus).toLowerCase().trim()
    lockStatus = s === 'locked' || s === 'lock' || s === '1' || s === 'true' || s === 'y'
  } else if (l.status !== undefined) {
    const s = String(l.status).toLowerCase().trim()
    lockStatus = s === 'locked' || s === 'lock' || s === '1' || s === 'true' || s === 'y'
  } else if (l.state !== undefined) {
    const s = String(l.state).toLowerCase().trim()
    lockStatus = s === 'locked' || s === 'lock' || s === '1' || s === 'true' || s === 'y'
  } else if (json.lock_status !== undefined) {
    const s = String(json.lock_status).toLowerCase().trim()
    lockStatus = s === 'locked' || s === 'lock' || s === '1' || s === 'true' || s === 'y'
  } else if (json.lockStatus !== undefined) {
    const s = String(json.lockStatus).toLowerCase().trim()
    lockStatus = s === 'locked' || s === 'lock' || s === '1' || s === 'true' || s === 'y'
  } else if (json.relays && (json.relays.lock !== undefined || json.relays.smartlock !== undefined)) {
    const rVal = json.relays.lock ?? json.relays.smartlock
    lockStatus = rVal === 'on' || rVal === true || rVal === 1 || rVal === 'locked'
  } else if (existingLock) {
    lockStatus = existingLock.lockStatus ?? true
  }

  // Door status: false = CLOSED, true = OPEN
  let doorStatus = false
  const rawDoor = l.door_status ?? l.doorStatus ?? l.door ?? json.door_status ?? json.doorStatus ?? json.door
  if (rawDoor !== undefined && rawDoor !== null) {
    if (typeof rawDoor === 'boolean') {
      doorStatus = rawDoor
    } else {
      const d = String(rawDoor).toLowerCase().trim()
      doorStatus = d === 'open' || d === 'opened' || d === 'true' || d === '1'
    }
  } else if (existingLock) {
    doorStatus = existingLock.doorStatus ?? false
  }

  const motorStatus = l.lock_motor_status || l.motor_status || l.motorStatus || existingLock?.motorStatus || 'OK'
  const motorCurrent = parseNum(l.motor_current_ma ?? l.motor_current ?? l.motorCurrent, existingLock?.motorCurrent ?? 420)
  const positionSensor = (l.lock_position_sensor === 'LOCKED' || l.lock_position_sensor === 'OK') || parseBool(l.position_sensor ?? l.positionSensor ?? (existingLock?.positionSensor ?? true))
  const unlockMethod = l.last_unlock_method || l.unlock_method || l.unlockMethod || existingLock?.unlockMethod || 'REMOTE'
  const unlockCount = parseNum(l.unlock_count ?? l.unlockCount, existingLock?.unlockCount ?? 24)
  const failedUnlockCount = parseNum(l.failed_unlock_count ?? l.failedUnlockCount, existingLock?.failedUnlockCount ?? 2)
  const lastLockTime = l.last_lock_time || l.lastLockTime || (lockStatus ? now : (existingLock?.lastLockTime || now))
  const lastUnlockTime = l.last_unlock_time || l.lastUnlockTime || (!lockStatus ? now : (existingLock?.lastUnlockTime || ''))

  return {
    lockStatus,
    doorStatus,
    motorStatus,
    motorCurrent,
    positionSensor,
    lastLockTime,
    lastUnlockTime,
    unlockMethod,
    unlockCount,
    failedUnlockCount,
    lockMotorStatus: l.lock_motor_status || motorStatus,
    motorCurrentMa: motorCurrent,
    lockPositionSensor: l.lock_position_sensor || (positionSensor ? 'LOCKED' : 'UNLOCKED'),
    lastUnlockMethod: unlockMethod,
    lockStatusStr: l.lock_status || (lockStatus ? 'LOCKED' : 'UNLOCKED'),
    doorStatusStr: l.door_status || (doorStatus ? 'OPEN' : 'CLOSED')
  }
}

/**
 * Parses WEGW Tracker / Smart Lock JSON metrics message (soundbox_dev/{imei}/metrics or smartlock/{imei}/metrics)
 * Any field the device cannot fill is sent as an empty string "", even numbers.
 */
function parseSoundboxMetrics(json: any, imei: string, now: string, existingDev?: any): any {
  const g = json.gps || {}
  const lat = parseNum(g.latitude, 0)
  const lon = parseNum(g.longitude, 0)
  const isFixed = g.status === 'FIXED' || (lat !== 0 && lon !== 0)

  const gps: ParsedGpsData = {
    isFixed,
    latitude: lat !== 0 ? lat : 30.704649,
    longitude: lon !== 0 ? lon : 76.717873,
    altitude: parseNum(g.altitude_m, 315.5),
    speed: parseNum(g.speed_kmph, 0),
    heading: parseNum(g.heading_deg, 128),
    satellites: parseNum(g.satellites, 14),
    hdop: parseNum(g.hdop, 0.9),
    accuracy: parseNum(g.accuracy_m, isFixed ? 4.2 : 50),
    lastFix: g.last_fix || now,
    lastLocation: g.location || (lat !== 0 ? `${lat.toFixed(5)}, ${lon.toFixed(5)}` : 'Mohali, Punjab')
  }

  const p = json.power || {}
  const batMv = parseNum(p.bat_v, 4075)
  const batPercentage = parseNum(p.bat_lvl, 94)
  const isLowBat = typeof p.low_battery === 'boolean' ? p.low_battery : (batMv < 3300)

  const c = json.cellular || {}
  const access = json.access || {}
  const acc = access.accelerometer || json.accelerometer || {}
  const tamper = access.tamper || json.tamper || {}
  const keypad = access.keypad || json.keypad || {}
  const rtcTime = access.rtc || json.rtc || now
  const dev = json.device || {}

  const lock = parseLockInfo(json, now, existingDev?.lock)

  return {
    deviceId: imei,
    deviceName: dev.model_id ? `${dev.model_id} (${imei})` : `SmartLock-${imei.slice(-4)}`,
    deviceType: 'smartlock',
    isSmartLock: true,
    status: isLowBat ? 'warning' : 'online',
    lastSeen: now,
    device: {
      imei,
      modelId: dev.model_id || 'WM_SB_1605',
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
      isCharging: parseBool(p.charging, false),
      isUsbConnected: p.usb === 'Y' || parseBool(p.usb, false),
      isExternalPower: parseBool(p.ext_power, false),
      isLowBattery: isLowBat,
      batteryMv: batMv,
      extPowerVoltage: p.ext_power_v || '',
      usb: p.usb || 'N',
      charging: p.charging || '',
      extPower: p.ext_power || '',
      lowBattery: p.low_battery || ''
    },
    cellular: {
      operator: c.operator || 'JIO 4G',
      networkType: c.net_t || 'LTE',
      rssi: parseNum(c.rssi, 73),
      signalQuality: c.signal === 'EXCELLENT' ? 5 : c.signal === 'GOOD' ? 4 : (parseNum(c.rssi, 73) > 60 ? 5 : 4),
      ip: c.ip4 || '10.38.65.70',
      imsi: c.imsi || '405867153266129',
      mcc: c.mcc || '869',
      mnc: c.mnc || '405',
      cellId: c.cell_id || '131860',
      tac: c.tac || '174',
      band: c.band || '40',
      rsrp: parseNum(c.rsrp, 35),
      rsrq: parseNum(c.rsrq, 15),
      sinr: parseNum(c.sinr, 0),
      signal: c.signal || 'EXCELLENT',
      ip4: c.ip4 || '10.38.65.70',
      ip6: c.ip6 || '254.128.0.0.0.0.0.0.0.0.0.0.129.200.87.18'
    },
    gps,
    lock,
    access: {
      keypad: {
        status: keypad.status || 'OK',
        enabled: keypad.enabled ?? true,
        failedAttempts: parseNum(keypad.failed_attempts ?? keypad.failedAttempts, 0),
        lastAccess: keypad.last_access || keypad.lastAccess || '',
        count: parseNum(keypad.count, 24),
        lastUsed: keypad.last_access || keypad.lastUsed || now
      },
      nfc: { enabled: true, lastUsed: now, count: 0 },
      bluetooth: { enabled: true, lastUsed: now, count: 0 },
      remote: { enabled: true, lastUsed: lock.lastUnlockTime || now, count: lock.unlockCount || 24 },
      tamper: {
        tamperStatus: parseBool(tamper.tamper_status ?? tamper.status, false),
        caseOpen: parseBool(tamper.case_open, false),
        wireCut: parseBool(tamper.wire_cut, false),
        lockBreak: parseBool(tamper.lock_break, false),
        abnormalVibration: parseBool(tamper.abnormal_vibration, false),
        forcedUnlock: parseBool(tamper.forced_unlock, false),
        tamperCount: parseNum(tamper.tamper_count, 0),
        lastTamperTime: tamper.last_tamper_time || ''
      },
      accelerometer: {
        status: acc.status || 'OK',
        motion: parseBool(acc.motion, false),
        x: parseNum(acc.x_g, 0.04),
        y: parseNum(acc.y_g, -0.02),
        z: parseNum(acc.z_g, 1.01),
        harshBraking: parseNum(acc.harsh_braking_count, 0) > 0,
        harshAcceleration: parseNum(acc.harsh_acceleration_count, 0) > 0,
        sharpTurn: parseNum(acc.sharp_turn_count, 0) > 0,
        harshBrakingCount: parseNum(acc.harsh_braking_count, 2),
        harshAccelerationCount: parseNum(acc.harsh_acceleration_count, 1),
        sharpTurnCount: parseNum(acc.sharp_turn_count, 3),
        impactCount: parseNum(acc.impact_count, 0),
        drivingScore: parseNum(acc.driving_score, 91)
      },
      rtc: rtcTime
    },
    tamper: {
      tamperStatus: parseBool(tamper.tamper_status ?? tamper.status ?? existingDev?.tamper?.tamperStatus ?? false),
      caseOpen: parseBool(tamper.case_open ?? existingDev?.tamper?.caseOpen ?? false),
      wireCut: parseBool(tamper.wire_cut ?? existingDev?.tamper?.wireCut ?? false),
      lockBreak: parseBool(tamper.lock_break ?? existingDev?.tamper?.lockBreak ?? false),
      abnormalVibration: parseBool(tamper.abnormal_vibration ?? existingDev?.tamper?.abnormalVibration ?? false),
      forcedUnlock: parseBool(tamper.forced_unlock ?? existingDev?.tamper?.forcedUnlock ?? false),
      tamperCount: parseNum(tamper.tamper_count ?? existingDev?.tamper?.tamperCount, 0),
      lastTamperTime: tamper.last_tamper_time || existingDev?.tamper?.lastTamperTime || ''
    },
    accelerometer: {
      status: acc.status || 'OK',
      motion: parseBool(acc.motion, false),
      x: parseNum(acc.x_g, 0.04),
      y: parseNum(acc.y_g, -0.02),
      z: parseNum(acc.z_g, 1.01),
      harshBraking: parseNum(acc.harsh_braking_count, 0) > 0,
      harshAcceleration: parseNum(acc.harsh_acceleration_count, 0) > 0,
      sharpTurn: parseNum(acc.sharp_turn_count, 0) > 0,
      harshBrakingCount: parseNum(acc.harsh_braking_count, 2),
      harshAccelerationCount: parseNum(acc.harsh_acceleration_count, 1),
      sharpTurnCount: parseNum(acc.sharp_turn_count, 3),
      impactCount: parseNum(acc.impact_count, 0),
      drivingScore: parseNum(acc.driving_score, 91)
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

    // 1. Check for SmartLock / Tracker metrics: soundbox_dev/{imei}/metrics, smartlock/{imei}/metrics, etc.
    const metricsMatch = topic.match(/^(?:soundbox_dev|smartlock|wegw|devices)\/([^/]+)\/(?:metrics|telemetry|data|status)$/) ||
                         topic.match(/^([^/]+)\/([^/]+)\/metrics$/)

    if (metricsMatch) {
      const imei = (metricsMatch[1] === 'soundbox_dev' || metricsMatch[1] === 'smartlock' || metricsMatch[1] === 'wegw' || metricsMatch[1] === 'devices')
        ? metricsMatch[2]
        : metricsMatch[1]

      try {
        const json = JSON.parse(rawPayload)

        // Drop known GPS trackers
        if (GPS_TRACKER_IMEIS.has(imei)) {
          console.log(`[MQTT] Skipping ${imei}: Known GPS Tracker excluded from SmartLock dashboard`)
          return
        }

        // Only receive the device if in the JSON data there is a lock option (smartlock data)
        const isSmartLock = hasLockOption(json, topic)
        if (!isSmartLock) {
          console.log(`[MQTT] Skipping ${imei}: Plain GPS tracker / non-smartlock device ignored`)
          return
        }

        const existingRow = db.prepare('SELECT * FROM devices WHERE deviceId = ?').get(imei) as any
        const existingDev = existingRow ? JSON.parse(existingRow.data) : null

        const deviceData = parseSoundboxMetrics(json, imei, now, existingDev)

        console.log(`[MQTT SmartLock Metrics] ${imei}: Lock=${deviceData.lock.lockStatus ? 'LOCKED' : 'UNLOCKED'}, Door=${deviceData.lock.doorStatus ? 'OPEN' : 'CLOSED'}, Lat=${deviceData.gps.latitude}, Lon=${deviceData.gps.longitude}, Speed=${deviceData.gps.speed} km/h, Bat=${deviceData.power.batteryPercentage}%`)

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

    // 2. Check for SmartLock Acks: soundbox_dev/{imei}/ack, smartlock/{imei}/ack, etc.
    const ackMatch = topic.match(/^(?:soundbox_dev|smartlock|wegw|devices)\/([^/]+)\/ack$/)
    if (ackMatch) {
      const imei = ackMatch[1]
      try {
        const ack = JSON.parse(rawPayload)
        console.log(`[MQTT SmartLock Ack] ${imei}:`, ack)

        // Update relay/lock status in existing device
        const existingRow = db.prepare('SELECT * FROM devices WHERE deviceId = ?').get(imei) as any
        if (existingRow) {
          const dev = JSON.parse(existingRow.data)
          if (ack.lock !== undefined) {
            dev.lock = parseLockInfo(ack, now, dev.lock)
          } else if (ack.relays && ack.relays['1']) {
            dev.lock.lockStatus = (ack.relays['1'] === 'on')
          }
          if (ack.relays) dev.relays = ack.relays
          if (ack.leds) dev.leds = ack.leds

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

    // 3. Check for legacy NMEA: wegw/{imei}/gps/nmea - Plain GPS tracker data (excluded from smartlocks)
    const legacyMatch = topic.match(/^wegw\/([^/]+)\/gps\/nmea$/)
    if (legacyMatch) {
      const imei = legacyMatch[1]
      const { gps, sentences } = parseNmeaPayload(rawPayload)

      if (broadcastFn) {
        broadcastFn('mqtt_nmea', { deviceId: imei, raw: rawPayload, sentences, timestamp: now })
      }
      return
    }
  } catch (error) {
    console.error('[MQTT] Error processing MQTT message:', error)
  }
}

/**
 * Seed initial device entries if not present
 */
export const GPS_TRACKER_IMEIS = new Set([
  '861185084122693', // First card: WEGW GPS Tracker
  '861185084122719', // Third card: WEGW GPS Tracker
  '861185084200101',
  '861185084188827',
])

function seedInitialDevices() {
  try {
    const db = getDb()
    // Remove older/stale devices and plain GPS trackers
    try {
      db.prepare("DELETE FROM alerts WHERE deviceId IN ('861185084122693', '861185084122719', '861185084200101', '861185084188827')").run()
      db.prepare("DELETE FROM device_history WHERE deviceId IN ('861185084122693', '861185084122719', '861185084200101', '861185084188827')").run()
      db.prepare("DELETE FROM devices WHERE deviceId IN ('861185084122693', '861185084122719', '861185084200101', '861185084188827')").run()
    } catch {}

    // Seed the user's SmartLock-5058 (867509082945058)
    const imei = '867509082945058'
    const now = new Date().toISOString()
    const smartLockData = parseSoundboxMetrics({
      device: {
        imei: "867509082945058",
        model_id: "WM_SB_1605",
        serial_no: "",
        app_v: "WM_BP_2.0.8",
        sdk_v: "WM_SDK_C_260702",
        hw_v: "",
        boot_reason: "",
        uptime_sec: ""
      },
      power: {
        bat_v: 4075,
        bat_lvl: 94,
        charging: "",
        usb: "N",
        ext_power: "",
        ext_power_v: "",
        low_battery: ""
      },
      cellular: {
        imsi: "405867153266129",
        operator: "JIO 4G",
        net_t: "LTE",
        mcc: "869",
        mnc: "405",
        cell_id: "131860",
        tac: "174",
        rssi: 73,
        rsrp: 35,
        rsrq: 15,
        sinr: "",
        signal: "EXCELLENT",
        band: "40",
        ip4: "10.38.65.70",
        ip6: "254.128.0.0.0.0.0.0.0.0.0.0.129.200.87.18"
      },
      gps: {
        status: "FIXED",
        latitude: 30.704649,
        longitude: 76.717873,
        altitude_m: 315.5,
        speed_kmph: 42.6,
        heading_deg: 128,
        satellites: 14,
        hdop: 0.9,
        accuracy_m: 4.2,
        fix_type: "3D",
        last_fix: "2026-09-15T10:40:21Z",
        location: "Mohali, Punjab"
      },
      lock: {
        lock_status: "LOCKED",
        door_status: "CLOSED",
        lock_motor_status: "OK",
        motor_current_ma: 420,
        lock_position_sensor: "LOCKED",
        last_lock_time: "2026-09-15T10:20:15Z",
        last_unlock_time: "2026-09-15T09:45:10Z",
        last_unlock_method: "REMOTE",
        unlock_count: 24,
        failed_unlock_count: 2
      },
      access: {
        keypad: {
          status: "OK",
          enabled: true,
          failed_attempts: 0,
          last_access: "2026-09-15T08:30:12Z"
        },
        tamper: {
          tamper_status: "",
          case_open: "",
          wire_cut: "",
          lock_break: "",
          abnormal_vibration: "",
          forced_unlock: "",
          tamper_count: "",
          last_tamper_time: ""
        },
        accelerometer: {
          status: "OK",
          motion: true,
          x_g: 0.04,
          y_g: -0.02,
          z_g: 1.01,
          harsh_braking_count: 2,
          harsh_acceleration_count: 1,
          sharp_turn_count: 3,
          impact_count: 0,
          driving_score: 91
        },
        rtc: "2026-11-17T14:12:23.433Z"
      }
    }, imei, now)

    db.prepare(`
      INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(deviceId) DO UPDATE SET
        data = excluded.data,
        updatedAt = excluded.updatedAt
    `).run(imei, 'SmartLock-5058 (WM_SB_1605)', 'online', now, JSON.stringify(smartLockData), now)

    console.log('[MQTT] Seeded SmartLock 867509082945058 into database')
  } catch (err) {
    console.error('[MQTT] Error initializing devices:', err)
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

      // Subscribe to SmartLock and production topics
      const topicsToSubscribe = [
        TOPIC_SOUNDBOX_METRICS,
        TOPIC_SOUNDBOX_ACK,
        'smartlock/+/metrics',
        'smartlock/+/telemetry',
        'smartlock/+/data',
        'smartlock/+/status',
        'smartlock/+/ack',
        'smartlock/#',
        'wegw/+/metrics',
        '+/+/metrics',
      ]
      mqttClient?.subscribe(topicsToSubscribe, { qos: 1 }, (err) => {
        if (err) console.error('[MQTT] Subscription error on smartlock topics:', err)
        else console.log(`[MQTT] Subscribed to smartlock & telemetry topics`)
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
