import { Router, Request, Response } from 'express'
import { getDb } from '../services/database'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// POST /api/devices/:id/telemetry - Device sends telemetry data
router.post('/devices/:id/telemetry', (req: Request, res: Response) => {
  try {
    const deviceId = req.params.id as string
    const data = req.body
    const db = getDb()
    const now = new Date().toISOString()

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

// GET /api/devices - Get all devices (latest state)
router.get('/devices', (req: Request, res: Response) => {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM devices ORDER BY updatedAt DESC').all()
    
    const devices = rows.map((row: any) => ({
      ...JSON.parse(row.data),
      status: row.status,
      lastSeen: row.lastSeen,
      deviceId: row.deviceId,
      deviceName: row.deviceName,
    }))

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

    const device = {
      ...JSON.parse(row.data),
      status: row.status,
      lastSeen: row.lastSeen,
      deviceId: row.deviceId,
      deviceName: row.deviceName,
    }

    res.json(device)
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
  const alerts: Array<{id: string, deviceId: string, type: string, message: string, severity: string}> = []
  
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
