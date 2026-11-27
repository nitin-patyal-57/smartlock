import { Router, Request, Response } from 'express'
import { getDb } from '../services/database'
import { v4 as uuidv4 } from 'uuid'
import { publishGpsCommand, publishRelayCommand, publishLedCommand, publishStatusCommand, hasLockOption, parseLockInfo } from '../services/mqttService'

const router = Router()

// POST /api/devices/:id/telemetry - Device sends telemetry data
router.post('/devices/:id/telemetry', (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id as string
    const data = req.body
    const db = getDb()
    const now = new Date().toISOString()

    // Receive device only if in JSON data there is a lock option (smartlock data)
    const isSmartLock = hasLockOption(data)
    if (!isSmartLock) {
      return res.status(400).json({ error: 'Device data is not a SmartLock payload (GPS tracker rejected)' })
    }

    data.isSmartLock = true
    data.deviceType = 'smartlock'

    // Parse and normalize the lock info into data.lock
    data.lock = parseLockInfo(data, now, data.lock)

    // Upsert device latest state
    const deviceName = data.deviceName || data.device?.modelId || deviceId
    const status = 'online'

    db.prepare(`
      INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(deviceId) DO UPDATE SET
        status = excluded.status,
        lastSeen = excluded.lastSeen,
        data = excluded.data,
        updatedAt = excluded.updatedAt
    `).run(deviceId, deviceName, status, now, JSON.stringify(data), now)

    // Insert history record (GPS + key metrics)
    if (data.gps) {
      db.prepare(`
        INSERT INTO device_history 
        (deviceId, latitude, longitude, altitude, speed, heading, accuracy, 
         batteryPercentage, batteryVoltage, lockStatus, doorStatus, signalQuality, rssi, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        deviceId,
        data.gps.latitude || 0,
        data.gps.longitude || 0,
        data.gps.altitude || 0,
        data.gps.speed || 0,
        data.gps.heading || 0,
        data.gps.accuracy || 0,
        data.power?.batteryPercentage || 0,
        data.power?.batteryVoltage || 0,
        data.lock?.lockStatus ? 1 : 0,
        data.lock?.doorStatus ? 1 : 0,
        data.cellular?.signalQuality || 0,
        data.cellular?.rssi || 0,
        now
      )
    }

    // Auto-generate alerts based on data
    const alerts = generateAlerts(deviceId, data)
    const insertAlert = db.prepare(`
      INSERT OR IGNORE INTO alerts (id, deviceId, type, message, severity, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    for (const alert of alerts) {
      insertAlert.run(alert.id, alert.deviceId, alert.type, alert.message, alert.severity, now)
    }

    // Broadcast to WebSocket clients
    const broadcast = req.app.get('broadcast')
    if (broadcast) {
      broadcast('device_update', { deviceId, data, timestamp: now })
      for (const alert of alerts) {
        broadcast('alert', alert)
      }
    }

    res.json({ success: true, deviceId, timestamp: now })
  } catch (error) {
    console.error('Error processing telemetry:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/devices/:id/command - Send downlink command to device via MQTT
router.post('/devices/:id/command', async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id as string
    const { command } = req.body

    if (!command || typeof command !== 'string') {
      return res.status(400).json({ error: 'Command string is required (e.g. "stream=1")' })
    }

    const success = await publishGpsCommand(deviceId, command)
    if (success) {
      res.json({ success: true, deviceId, command, timestamp: new Date().toISOString() })
    } else {
      res.status(502).json({ error: 'Failed to publish command to MQTT broker', deviceId })
    }
  } catch (error) {
    console.error('Error publishing command:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/devices/:id/relay - Send relay command: {"relay": 1, "state": "on" | "off"}
router.post('/devices/:id/relay', async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id as string
    const { relay, state } = req.body

    const relayNum = Number(relay) as 1 | 2
    if (relayNum !== 1 && relayNum !== 2) {
      return res.status(400).json({ error: 'Relay must be 1 or 2' })
    }
    if (state !== 'on' && state !== 'off') {
      return res.status(400).json({ error: 'State must be "on" or "off"' })
    }

    const success = await publishRelayCommand(deviceId, relayNum, state)
    if (success) {
      res.json({ success: true, deviceId, relay: relayNum, state, timestamp: new Date().toISOString() })
    } else {
      res.status(502).json({ error: 'Failed to publish relay command', deviceId })
    }
  } catch (error) {
    console.error('Error publishing relay command:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/devices/:id/led - Send LED command: {"led": "red"|"green"|"blue"|"all", "state": "on"|"off"|"blink"|"auto", "duration_s": 10}
router.post('/devices/:id/led', async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id as string
    const { led, state, duration_s } = req.body

    if (!['red', 'green', 'blue', 'all'].includes(led)) {
      return res.status(400).json({ error: 'led must be red, green, blue or all' })
    }
    if (!['on', 'off', 'blink', 'auto'].includes(state)) {
      return res.status(400).json({ error: 'state must be on, off, blink or auto' })
    }

    const durationS = typeof duration_s === 'number' ? duration_s : 0
    const success = await publishLedCommand(deviceId, led, state, durationS)
    if (success) {
      res.json({ success: true, deviceId, led, state, duration_s: durationS, timestamp: new Date().toISOString() })
    } else {
      res.status(502).json({ error: 'Failed to publish LED command', deviceId })
    }
  } catch (error) {
    console.error('Error publishing LED command:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/devices/:id/status-cmd - Send status command: {"cmd": "status"}
router.post('/devices/:id/status-cmd', async (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id as string
    const success = await publishStatusCommand(deviceId)
    if (success) {
      res.json({ success: true, deviceId, timestamp: new Date().toISOString() })
    } else {
      res.status(502).json({ error: 'Failed to publish status command', deviceId })
    }
  } catch (error) {
    console.error('Error publishing status command:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const GPS_TRACKER_IMEIS = new Set([
  '861185084122693', // First card: GPS Tracker confirmed by user
  '861185084122719', // Third card: GPS Tracker confirmed by user
  '861185084200101',
  '861185084188827',
  '867787064208584',
])

// GET /api/devices - Get all devices (latest state)
router.get('/devices', (req: Request, res: Response) => {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM devices ORDER BY updatedAt DESC').all()
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()

    // Only include genuine SmartLock devices (exclude plain GPS trackers / soundboxes)
    const devices = rows
      .map((row: any) => {
        try {
          const parsed = JSON.parse(row.data)
          const isOnline = row.status === 'online' && row.lastSeen && row.lastSeen >= cutoff
          return {
            ...parsed,
            status: isOnline ? 'online' : 'offline',
            lastSeen: row.lastSeen || '',
            deviceId: row.deviceId,
            deviceName: row.deviceName,
          }
        } catch {
          return null
        }
      })
      .filter((d: any) => d && d.deviceId && !GPS_TRACKER_IMEIS.has(d.deviceId) && (d.isSmartLock === true || d.deviceType === 'smartlock' || hasLockOption(d)))

    res.json(devices)
  } catch (error) {
    console.error('Error fetching devices:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/devices/:id - Get single device
router.get('/devices/:id', (req: Request, res: Response) => {
  try {
    const db = getDb()
    const row = db.prepare('SELECT * FROM devices WHERE deviceId = ?').get(req.params.id) as any

    if (!row) {
      return res.status(404).json({ error: 'Device not found' })
    }

    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const isOnline = row.status === 'online' && row.lastSeen && row.lastSeen >= cutoff

    const parsed = JSON.parse(row.data)
    parsed.deviceId = row.deviceId
    parsed.deviceName = row.deviceName?.includes('GW1NS-4') ? `SmartLock-${row.deviceId.slice(-4)} (WM_SB_1605)` : row.deviceName
    parsed.status = isOnline ? 'online' : 'offline'
    parsed.lastSeen = row.lastSeen || ''

    if (parsed.device) {
      parsed.device.imei = row.deviceId
      parsed.device.modelId = parsed.device.modelId || 'WM_SB_1605'
    }

    res.json(parsed)
  } catch (error) {
    console.error('Error fetching device:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/devices/:id/history - Get location history
router.get('/devices/:id/history', (req: Request, res: Response) => {
  try {
    const db = getDb()
    const { from, to } = req.query

    let query = 'SELECT * FROM device_history WHERE deviceId = ?'
    const params: any[] = [req.params.id]

    if (from) {
      query += ' AND timestamp >= ?'
      params.push(from)
    }
    if (to) {
      query += ' AND timestamp <= ?'
      params.push(to)
    }

    query += ' ORDER BY timestamp ASC'

    const rows = db.prepare(query).all(...params)

    const history = rows.map((row: any) => ({
      id: `hist-${row.id}`,
      deviceId: row.deviceId,
      latitude: row.latitude,
      longitude: row.longitude,
      altitude: row.altitude,
      speed: row.speed,
      heading: row.heading,
      accuracy: row.accuracy,
      batteryPercentage: row.batteryPercentage,
      lockStatus: row.lockStatus === 1,
      timestamp: row.timestamp,
      isFixed: true,
    }))

    res.json(history)
  } catch (error) {
    console.error('Error fetching history:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/devices - Register new device manually
router.post('/devices', (req: Request, res: Response) => {
  try {
    const { imei, deviceName, modelId } = req.body
    if (!imei) {
      return res.status(400).json({ error: 'Device IMEI is required' })
    }

    const cleanImei = String(imei).trim()
    const db = getDb()
    const now = new Date().toISOString()
    const name = deviceName?.trim() || `Smart Lock ${cleanImei.slice(-4)}`
    const model = modelId?.trim() || 'GW1NS-4'

    // Check if device already exists
    const existing = db.prepare('SELECT * FROM devices WHERE deviceId = ?').get(cleanImei) as any
    if (existing) {
      const dev = {
        ...JSON.parse(existing.data),
        deviceId: existing.deviceId,
        deviceName: existing.deviceName,
        status: existing.status,
        lastSeen: existing.lastSeen,
      }
      return res.json({ success: true, device: dev })
    }

    const initialData = {
      deviceId: cleanImei,
      deviceName: name,
      status: 'online',
      lastSeen: now,
      device: {
        imei: cleanImei,
        modelId: 'WM_SB_1605',
        serialNumber: '',
        appVersion: 'WM_BP_2.0.8',
        sdkVersion: 'WM_SDK_C_260702',
        hardwareVersion: '',
        bootReason: '',
        uptime: 0,
      },
      power: {
        batteryVoltage: 4.08,
        batteryPercentage: 94,
        isCharging: false,
        isUsbConnected: false,
        isExternalPower: false,
        isLowBattery: false,
        batteryMv: 4075,
        extPowerVoltage: '',
        usb: 'N',
        charging: '',
        extPower: '',
        lowBattery: '',
      },
      cellular: {
        operator: 'JIO 4G',
        networkType: 'LTE',
        rssi: 73,
        signalQuality: 5,
        ip: '10.38.65.70',
        imsi: '405867153266129',
        mcc: '869',
        mnc: '405',
        cellId: '131860',
        tac: '174',
        band: '40',
        rsrp: 35,
        rsrq: 15,
        sinr: 0,
        signal: 'EXCELLENT',
        ip4: '10.38.65.70',
        ip6: '254.128.0.0.0.0.0.0.0.0.0.0.129.200.87.18',
      },
      gps: {
        isFixed: true,
        latitude: 30.704649,
        longitude: 76.717873,
        altitude: 315.5,
        speed: 42.6,
        heading: 128,
        satellites: 14,
        hdop: 0.9,
        accuracy: 4.2,
        lastFix: '2026-09-15T10:40:21Z',
        lastLocation: 'Mohali, Punjab',
        fixType: '3D',
        status: 'FIXED',
      },
      lock: {
        lockStatus: true,
        doorStatus: false,
        motorStatus: 'OK',
        motorCurrent: 420,
        positionSensor: true,
        lastLockTime: '2026-09-15T10:20:15Z',
        lastUnlockTime: '2026-09-15T09:45:10Z',
        unlockMethod: 'REMOTE',
        unlockCount: 24,
        failedUnlockCount: 2,
        lockMotorStatus: 'OK',
        motorCurrentMa: 420,
        lockPositionSensor: 'LOCKED',
        lastUnlockMethod: 'REMOTE',
        lockStatusStr: 'LOCKED',
        doorStatusStr: 'CLOSED',
      },
      access: {
        keypad: {
          status: 'OK',
          enabled: true,
          failedAttempts: 0,
          lastAccess: '2026-09-15T08:30:12Z',
          lastUsed: '2026-09-15T08:30:12Z',
          count: 24,
        },
        nfc: { enabled: true, lastUsed: '', count: 0 },
        bluetooth: { enabled: true, lastUsed: '', count: 0 },
        remote: { enabled: true, lastUsed: '2026-09-15T10:20:15Z', count: 24 },
        rtc: '2026-11-17T14:12:23.433Z',
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
        motion: true,
        x: 0.04,
        y: -0.02,
        z: 1.01,
        status: 'OK',
        harshBraking: true,
        harshAcceleration: true,
        sharpTurn: true,
        harshBrakingCount: 2,
        harshAccelerationCount: 1,
        sharpTurnCount: 3,
        impactCount: 0,
        drivingScore: 91,
      },
      rtc: '2026-11-17T14:12:23.433Z',
    }

    db.prepare(`
      INSERT INTO devices (deviceId, deviceName, status, lastSeen, data, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(cleanImei, name, 'online', now, JSON.stringify(initialData), now)

    res.status(201).json({ success: true, device: initialData })
  } catch (error: any) {
    console.error('Error registering device:', error)
    res.status(500).json({ error: error.message || 'Failed to register device' })
  }
})

// DELETE /api/devices - Clear ALL devices, history, and alerts
router.delete('/devices', (req: Request, res: Response) => {
  try {
    const db = getDb()
    db.prepare('DELETE FROM alerts').run()
    db.prepare('DELETE FROM device_history').run()
    db.prepare('DELETE FROM devices').run()
    const broadcast = req.app.get('broadcast')
    if (broadcast) {
      broadcast('devices_cleared', { timestamp: new Date().toISOString() })
    }
    res.json({ success: true, message: 'All older devices and history cleared successfully' })
  } catch (error) {
    console.error('Error clearing all devices:', error)
    res.status(500).json({ error: 'Failed to clear devices' })
  }
})

// DELETE /api/devices/:id - Remove device from dashboard
router.delete('/devices/:id', (req: Request, res: Response) => {
  try {
    const db = getDb()
    const deviceId = req.params.id as string
    db.prepare('DELETE FROM alerts WHERE deviceId = ?').run(deviceId)
    db.prepare('DELETE FROM device_history WHERE deviceId = ?').run(deviceId)
    db.prepare('DELETE FROM devices WHERE deviceId = ?').run(deviceId)
    res.json({ success: true, message: `Device ${deviceId} deleted` })
  } catch (error) {
    console.error('Error deleting device:', error)
    res.status(500).json({ error: 'Failed to delete device' })
  }
})

// POST /api/devices/:id/offline - Mark device as offline
router.post('/devices/:id/offline', (req: Request, res: Response) => {
  try {
    const db = getDb()
    db.prepare('UPDATE devices SET status = ?, updatedAt = ? WHERE deviceId = ?')
      .run('offline', new Date().toISOString(), req.params.id)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Helper: Generate alerts based on device data
function generateAlerts(deviceId: string, data: any) {
  const alerts: Array<{ id: string, deviceId: string, type: string, message: string, severity: string }> = []

  // Low battery
  if (data.power?.batteryPercentage !== undefined && data.power.batteryPercentage < 20) {
    alerts.push({
      id: uuidv4(),
      deviceId,
      type: 'low_battery',
      message: `Low battery: ${data.power.batteryPercentage}% on device ${deviceId}`,
      severity: data.power.batteryPercentage < 10 ? 'critical' : 'warning',
    })
  }

  // Tamper detection
  if (data.tamper?.tamperStatus) {
    alerts.push({
      id: uuidv4(),
      deviceId,
      type: 'tamper_detected',
      message: `Tamper alert on device ${deviceId}`,
      severity: 'critical',
    })
  }
  if (data.tamper?.forcedUnlock) {
    alerts.push({
      id: uuidv4(),
      deviceId,
      type: 'forced_unlock',
      message: `Forced unlock detected on device ${deviceId}`,
      severity: 'critical',
    })
  }
  if (data.tamper?.wireCut) {
    alerts.push({
      id: uuidv4(),
      deviceId,
      type: 'wire_cut',
      message: `Wire cut detected on device ${deviceId}`,
      severity: 'critical',
    })
  }
  if (data.tamper?.caseOpen) {
    alerts.push({
      id: uuidv4(),
      deviceId,
      type: 'case_open',
      message: `Case opened on device ${deviceId}`,
      severity: 'critical',
    })
  }
  if (data.tamper?.lockBreak) {
    alerts.push({
      id: uuidv4(),
      deviceId,
      type: 'lock_break',
      message: `Lock break detected on device ${deviceId}`,
      severity: 'critical',
    })
  }
  if (data.tamper?.abnormalVibration) {
    alerts.push({
      id: uuidv4(),
      deviceId,
      type: 'abnormal_vibration',
      message: `Abnormal vibration on device ${deviceId}`,
      severity: 'warning',
    })
  }

  // Geofence violation
  if (data.geofence?.violation) {
    alerts.push({
      id: uuidv4(),
      deviceId,
      type: 'geofence_violation',
      message: `Geofence violation on device ${deviceId}`,
      severity: 'warning',
    })
  }

  // Overspeed
  if (data.trip?.overspeedCount > 0) {
    alerts.push({
      id: uuidv4(),
      deviceId,
      type: 'overspeed',
      message: `Overspeed event on device ${deviceId}`,
      severity: 'warning',
    })
  }

  return alerts
}

export default router
