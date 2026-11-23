import type { SmartLockDevice } from '@/types/smartlock'
import { config } from './config'

export interface WalnutDevice {
  device: {
    imei: string
    model_id: string
    serial_no: string
    app_v: string
    sdk_v: string
    hw_v: string
    boot_reason: string
    uptime_sec: string | number
  }
  power: {
    bat_v: number
    bat_lvl: number
    charging: string
    usb: string
    ext_power: string
    ext_power_v: string
    low_battery: string
  }
  cellular: {
    imsi: string
    operator: string
    net_t: string
    mcc: string
    mnc: string
    cell_id: string
    tac: string
    rssi: number
    rsrp: number
    rsrq: number
    sinr: string
    signal: string
    band: string
    ip4: string
    ip6: string
  }
  gps: {
    status: string
    latitude: string | number
    longitude: string | number
    altitude_m: string | number
    speed_kmph: string | number
    heading_deg: string | number
    satellites: string | number
    hdop: string | number
    accuracy_m: string | number
    fix_type: string
    last_fix: string
    location: string
  }
  lock: {
    lock_status: string
    door_status: string
    lock_motor_status: string
    motor_current_ma: string | number
    lock_position_sensor: string
    last_lock_time: string
    last_unlock_time: string
    last_unlock_method: string
    unlock_count: string | number
    failed_unlock_count: string | number
  }
  access: {
    keypad: { status: string; enabled: string | boolean; failed_attempts: string | number; last_access: string }
    nfc: { status: string; enabled: string | boolean; last_card_id: string; last_access: string }
    bluetooth: { status: string; enabled: string | boolean; connected: string; bt_v: string; last_access: string }
    remote: { status: string; enabled: string | boolean; last_command: string; last_command_id: string; last_command_status: string; last_command_time: string }
  }
  tamper: {
    tamper_status: string
    case_open: string
    wire_cut: string
    lock_break: string
    abnormal_vibration: string
    forced_unlock: string
    tamper_count: string | number
    last_tamper_time: string
  }
  accelerometer: {
    status: string
    motion: string | boolean
    x_g: string | number
    y_g: string | number
    z_g: string | number
    harsh_braking_count: string | number
    harsh_acceleration_count: string | number
    sharp_turn_count: string | number
    impact_count: string | number
    driving_score: string | number
  }
  trip: {
    vehicle_status: string
    trip_status: string | boolean
    trip_id: string
    distance_km: string | number
    max_speed_kmph: string | number
    overspeed_count: string | number
  }
  geofence: {
    status: string
    geofence_id: string
    violation: string
    last_event: string
    last_event_time: string
  }
  sensors: {
    temperature_c: string | number
    internal_temperature_c: string | number
    humidity_pct: string | number
    accelerometer: string
    gps_antenna: string
    cellular_antenna: string
  }
  security: {
    device_binding: string
    vehicle_id: string
    customer_id: string
    certificate_status: string
    secure_boot: string | boolean
    firmware_signature: string
  }
  memory: {
    mem_t: number
    mem_u: number
    storage_t: string | number
    storage_u: string | number
  }
  diagnostics: {
    gps: string
    modem: string
    keypad: string
    nfc: string
    bluetooth: string
    accelerometer: string
    lock_motor: string
    tamper_sensor: string
  }
  rtc: string
}

function toNum(v: string | number | undefined | null, fallback = 0): number {
  if (v === '' || v === undefined || v === null) return fallback
  const n = Number(v)
  return isNaN(n) ? fallback : n
}

function toBool(v: any): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v === 1
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim()
    return (
      s === 'y' ||
      s === 'yes' ||
      s === 'true' ||
      s === '1' ||
      s === 'locked' ||
      s === 'ok' ||
      s === 'valid' ||
      s === 'bound' ||
      s === 'active' ||
      s === 'fixed' ||
      s === 'fix'
    )
  }
  return false
}

function deriveStatus(w: WalnutDevice): 'online' | 'offline' | 'warning' {
  if (w.power.low_battery === 'Y' || (w.power.bat_lvl !== undefined && w.power.bat_lvl <= 5 && w.power.bat_lvl > 0)) {
    return 'warning'
  }
  if (w.tamper.tamper_status === 'Y' || toBool(w.tamper.forced_unlock)) {
    return 'warning'
  }

  const rtc = w.rtc ? new Date(w.rtc).getTime() : 0
  if (!rtc) return 'offline'
  const now = Date.now()
  const minutesSinceUpdate = (now - rtc) / 60000

  if (minutesSinceUpdate <= 30) return 'online'
  return 'offline'
}

function mapToSmartLockDevice(w: WalnutDevice, index: number): SmartLockDevice {
  const status = deriveStatus(w)
  const deviceName = w.device.model_id
    ? `${w.device.model_id} (${w.device.imei.slice(-4)})`
    : `Smart Lock #${index + 1}`

  const isLockStatusTrue =
    typeof w.lock.lock_status === 'boolean'
      ? w.lock.lock_status
      : String(w.lock.lock_status || '').toLowerCase().trim() === 'locked' || toBool(w.lock.lock_status)

  const isDoorStatusOpen =
    typeof w.lock.door_status === 'boolean'
      ? w.lock.door_status
      : String(w.lock.door_status || '').toLowerCase().trim() === 'open'

  const gpsStatusStr = String(w.gps.status || '').toLowerCase().trim()
  const hasGpsFix = gpsStatusStr === 'fixed' || gpsStatusStr === 'fix' || (toNum(w.gps.latitude) !== 0 && toNum(w.gps.longitude) !== 0)

  const rawRssi = toNum(w.cellular.rssi)
  const signalQuality =
    rawRssi > 31
      ? Math.min(5, Math.max(1, Math.round(rawRssi / 20)))
      : Math.min(5, Math.max(1, Math.round((rawRssi / 31) * 5)))

  return {
    deviceId: w.device.imei,
    deviceName,
    status,
    lastSeen: w.rtc || new Date().toISOString(),
    device: {
      imei: w.device.imei,
      modelId: w.device.model_id || 'WM_SB_1605',
      serialNumber: w.device.serial_no || `SN-${w.device.imei.slice(-6)}`,
      appVersion: w.device.app_v || '2.0.0',
      sdkVersion: w.device.sdk_v || '1.0.0',
      hardwareVersion: w.device.hw_v || 'HW1.0',
      bootReason: w.device.boot_reason || 'power_on',
      uptime: toNum(w.device.uptime_sec),
    },
    power: {
      batteryVoltage: w.power.bat_v > 100 ? w.power.bat_v / 1000 : w.power.bat_v,
      batteryPercentage: toNum(w.power.bat_lvl),
      isCharging: w.power.charging === 'Y' || w.power.charging === 'true',
      isUsbConnected: w.power.usb === 'Y' || w.power.usb === 'true',
      isExternalPower: w.power.ext_power === 'Y' || w.power.ext_power === 'true',
      isLowBattery: w.power.low_battery === 'Y' || toNum(w.power.bat_lvl) <= 10,
    },
    cellular: {
      operator: w.cellular.operator || 'Cellular',
      networkType: w.cellular.net_t || 'LTE',
      rssi: rawRssi,
      signalQuality,
      ip: w.cellular.ip4 || '',
    },
    gps: {
      isFixed: hasGpsFix,
      latitude: toNum(w.gps.latitude),
      longitude: toNum(w.gps.longitude),
      altitude: toNum(w.gps.altitude_m),
      speed: toNum(w.gps.speed_kmph),
      heading: toNum(w.gps.heading_deg),
      satellites: toNum(w.gps.satellites),
      hdop: toNum(w.gps.hdop),
      accuracy: toNum(w.gps.accuracy_m),
      lastFix: w.gps.last_fix || '',
      lastLocation: w.gps.location || '',
    },
    lock: {
      lockStatus: isLockStatusTrue,
      doorStatus: isDoorStatusOpen,
      motorStatus: w.lock.lock_motor_status || 'OK',
      motorCurrent: toNum(w.lock.motor_current_ma),
      positionSensor: toBool(w.lock.lock_position_sensor),
      lastLockTime: w.lock.last_lock_time || '',
      lastUnlockTime: w.lock.last_unlock_time || '',
      unlockMethod: w.lock.last_unlock_method || 'REMOTE',
      unlockCount: toNum(w.lock.unlock_count),
      failedUnlockCount: toNum(w.lock.failed_unlock_count),
    },
    access: {
      keypad: {
        enabled: toBool(w.access.keypad.enabled),
        lastUsed: w.access.keypad.last_access || '',
        count: toNum(w.access.keypad.failed_attempts),
      },
      nfc: {
        enabled: toBool(w.access.nfc.enabled),
        lastUsed: w.access.nfc.last_access || '',
        count: 0,
      },
      bluetooth: {
        enabled: toBool(w.access.bluetooth.enabled),
        lastUsed: w.access.bluetooth.last_access || '',
        count: 0,
      },
      remote: {
        enabled: toBool(w.access.remote.enabled),
        lastUsed: w.access.remote.last_command_time || '',
        count: 0,
      },
    },
    tamper: {
      tamperStatus: toBool(w.tamper.tamper_status),
      caseOpen: toBool(w.tamper.case_open),
      wireCut: toBool(w.tamper.wire_cut),
      lockBreak: toBool(w.tamper.lock_break),
      abnormalVibration: toBool(w.tamper.abnormal_vibration),
      forcedUnlock: toBool(w.tamper.forced_unlock),
      tamperCount: toNum(w.tamper.tamper_count),
      lastTamperTime: w.tamper.last_tamper_time || '',
    },
    accelerometer: {
      motion: toBool(w.accelerometer.motion),
      x: toNum(w.accelerometer.x_g),
      y: toNum(w.accelerometer.y_g),
      z: toNum(w.accelerometer.z_g),
      harshBraking: toNum(w.accelerometer.harsh_braking_count) > 0,
      harshAcceleration: toNum(w.accelerometer.harsh_acceleration_count) > 0,
      sharpTurn: toNum(w.accelerometer.sharp_turn_count) > 0,
      impactCount: toNum(w.accelerometer.impact_count),
      drivingScore: toNum(w.accelerometer.driving_score, 100),
    },
    trip: {
      vehicleStatus: w.trip.vehicle_status || 'stationary',
      tripStatus: toBool(w.trip.trip_status),
      tripId: w.trip.trip_id || '',
      distance: toNum(w.trip.distance_km),
      maximumSpeed: toNum(w.trip.max_speed_kmph),
      overspeedCount: toNum(w.trip.overspeed_count),
    },
    geofence: {
      status: w.geofence.status || 'inside',
      geofenceId: w.geofence.geofence_id || '',
      violation: toBool(w.geofence.violation),
      lastEvent: w.geofence.last_event || '',
    },
    sensors: {
      temperature: toNum(w.sensors.temperature_c),
      internalTemperature: toNum(w.sensors.internal_temperature_c),
      humidity: toNum(w.sensors.humidity_pct),
      hardwareSensorStatus: w.sensors.accelerometer !== '',
    },
    security: {
      deviceBinding: toBool(w.security.device_binding),
      vehicleId: w.security.vehicle_id || '',
      customerId: w.security.customer_id || '',
      certificateStatus: toBool(w.security.certificate_status),
      secureBoot: toBool(w.security.secure_boot),
      firmwareSignature: toBool(w.security.firmware_signature),
    },
    memory: {
      totalStorage: toNum(w.memory.mem_t, 8388608),
      usedStorage: toNum(w.memory.mem_u, 0),
      freeStorage: Math.max(0, toNum(w.memory.mem_t, 8388608) - toNum(w.memory.mem_u, 0)),
    },
    diagnostics: {
      lastDiagnosticTime: w.rtc || '',
      errorCodes: [],
      systemHealth: status === 'online' ? 'good' : status === 'warning' ? 'degraded' : 'critical',
    },
    rtc: {
      rtcTime: w.rtc || '',
      rtcSynced: Boolean(w.rtc),
    },
  }
}

export function createRegisteredDevice(imei: string, index = 0): SmartLockDevice {
  return {
    deviceId: imei,
    deviceName: `Smart Lock (${imei.length > 6 ? imei.slice(-6) : imei})`,
    status: 'offline',
    lastSeen: 'No telemetry data received yet',
    device: {
      imei,
      modelId: 'WM_SB_1605',
      serialNumber: `SN-${imei.slice(-6)}`,
      appVersion: 'Pending',
      sdkVersion: 'Pending',
      hardwareVersion: 'HW1.0',
      bootReason: 'Waiting for device boot',
      uptime: 0,
    },
    power: {
      batteryVoltage: 0,
      batteryPercentage: 0,
      isCharging: false,
      isUsbConnected: false,
      isExternalPower: false,
      isLowBattery: true,
    },
    cellular: {
      operator: 'No Signal',
      networkType: 'Waiting',
      rssi: 0,
      signalQuality: 0,
      ip: '',
    },
    gps: {
      isFixed: false,
      latitude: 0,
      longitude: 0,
      altitude: 0,
      speed: 0,
      heading: 0,
      satellites: 0,
      hdop: 0,
      accuracy: 0,
      lastFix: '',
      lastLocation: 'No GPS fix reported yet',
    },
    lock: {
      lockStatus: false,
      doorStatus: false,
      motorStatus: 'idle',
      motorCurrent: 0,
      positionSensor: false,
      lastLockTime: '',
      lastUnlockTime: '',
      unlockMethod: 'N/A',
      unlockCount: 0,
      failedUnlockCount: 0,
    },
    access: {
      keypad: { enabled: false, lastUsed: '', count: 0 },
      nfc: { enabled: false, lastUsed: '', count: 0 },
      bluetooth: { enabled: false, lastUsed: '', count: 0 },
      remote: { enabled: false, lastUsed: '', count: 0 },
    },
    tamper: {
      tamperStatus: false,
      caseOpen: false,
      wireCut: false,
      lockBreak: false,
      abnormalVibration: false,
      forcedUnlock: false,
      tamperCount: 0,
      lastTamperTime: '',
    },
    accelerometer: {
      motion: false,
      x: 0,
      y: 0,
      z: 0,
      harshBraking: false,
      harshAcceleration: false,
      sharpTurn: false,
      impactCount: 0,
      drivingScore: 100,
    },
    trip: {
      vehicleStatus: 'stationary',
      tripStatus: false,
      tripId: '',
      distance: 0,
      maximumSpeed: 0,
      overspeedCount: 0,
    },
    geofence: {
      status: 'inside',
      geofenceId: '',
      violation: false,
      lastEvent: '',
    },
    sensors: {
      temperature: 0,
      internalTemperature: 0,
      humidity: 0,
      hardwareSensorStatus: false,
    },
    security: {
      deviceBinding: false,
      vehicleId: '',
      customerId: '',
      certificateStatus: false,
      secureBoot: false,
      firmwareSignature: false,
    },
    memory: {
      totalStorage: 8388608,
      usedStorage: 0,
      freeStorage: 8388608,
    },
    diagnostics: {
      lastDiagnosticTime: '',
      errorCodes: [],
      systemHealth: 'degraded',
    },
    rtc: {
      rtcTime: '',
      rtcSynced: false,
    },
  }
}

export async function fetchWalnutDevices(): Promise<SmartLockDevice[]> {
  const apiKey = config.walnut.apiKey
  const imeiConfig: string = String(config.walnut.imei || '')

  if (!apiKey || !imeiConfig) {
    throw new Error('Walnut API key or IMEI not configured')
  }

  // Support comma/semicolon-separated list of IMEIs
  const imeis: string[] = imeiConfig
    .split(/[,;\s]+/)
    .map((s: string) => s.trim())
    .filter(Boolean)

  if (imeis.length === 0) return []

  const devices: SmartLockDevice[] = []

  const results = await Promise.all(
    imeis.map(async (imei: string, index: number) => {
      try {
        const response = await fetch(config.walnut.apiUrl, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ imei }),
        })

        if (!response.ok) {
          console.warn(`Walnut API error ${response.status} for IMEI: ${imei}`)
          return [createRegisteredDevice(imei, index)]
        }

        const result = await response.json()

        if (result.status === 'success' && Array.isArray(result.data) && result.data.length > 0) {
          return result.data.map((w: WalnutDevice, subIndex: number) =>
            mapToSmartLockDevice(w, index + subIndex)
          )
        }

        // If success but data is empty [] (no logs recorded in DB yet for this IMEI),
        // show the registered device on the dashboard with waiting status
        return [createRegisteredDevice(imei, index)]
      } catch (err) {
        console.warn(`Failed to fetch Walnut device ${imei}:`, err)
        return [createRegisteredDevice(imei, index)]
      }
    })
  )

  results.forEach((deviceList) => {
    devices.push(...deviceList)
  })

  return devices
}

export async function fetchWalnutDeviceByImei(imei: string): Promise<SmartLockDevice | undefined> {
  const apiKey = config.walnut.apiKey
  if (!apiKey) {
    throw new Error('Walnut API key not configured')
  }

  try {
    const response = await fetch(config.walnut.apiUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imei }),
    })

    if (!response.ok) {
      return createRegisteredDevice(imei)
    }

    const result = await response.json()

    if (result.status === 'success' && Array.isArray(result.data) && result.data.length > 0) {
      return mapToSmartLockDevice(result.data[0], 0)
    }

    return createRegisteredDevice(imei)
  } catch (err) {
    console.warn(`Failed to fetch Walnut device by IMEI ${imei}:`, err)
    return createRegisteredDevice(imei)
  }
}
