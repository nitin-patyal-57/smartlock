import { Router, Request, Response } from 'express'
import { getDb } from '../services/database'
import { v4 as uuidv4 } from 'uuid'

const router = Router()

// GET /api/activity - Get activity events
router.get('/activity', (req: Request, res: Response) => {
  try {
    const db = getDb()
    const { deviceId, type } = req.query
    
    let query = 'SELECT * FROM activity WHERE 1=1'
    const params: any[] = []
    
    if (deviceId) {
      query += ' AND deviceId = ?'
      params.push(deviceId)
    }
    if (type) {
      query += ' AND type = ?'
      params.push(type)
    }
    
    query += ' ORDER BY timestamp DESC LIMIT 100'
    
    const rows = db.prepare(query).all(...params)
    
    const events = rows.map((row: any) => ({
      id: row.id,
      deviceId: row.deviceId,
      type: row.type,
      message: row.message,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }))

    res.json(events)
  } catch (error) {
    console.error('Error fetching activity:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/activity - Create activity event
router.post('/activity', (req: Request, res: Response) => {
  try {
    const db = getDb()
    const { deviceId, type, message, metadata } = req.body
    const id = uuidv4()
    const now = new Date().toISOString()
    
    db.prepare(`
      INSERT INTO activity (id, deviceId, type, message, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, deviceId, type, message, now, metadata ? JSON.stringify(metadata) : null)
    
    const event = { id, deviceId, type, message, timestamp: now, metadata }
    
    // Broadcast to WebSocket clients
    const broadcast = req.app.get('broadcast')
    if (broadcast) {
      broadcast('activity', event)
    }
    
    res.json(event)
  } catch (error) {
    console.error('Error creating activity:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
