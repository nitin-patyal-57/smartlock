import { Router, Request, Response } from 'express'
import { getDb } from '../services/database'

const router = Router()

// GET /api/alerts - Get all alerts
router.get('/alerts', (req: Request, res: Response) => {
  try {
    const db = getDb()
    const { severity, deviceId, acknowledged } = req.query
    
    let query = 'SELECT * FROM alerts WHERE 1=1'
    const params: any[] = []
    
    if (severity) {
      query += ' AND severity = ?'
      params.push(severity)
    }
    if (deviceId) {
      query += ' AND deviceId = ?'
      params.push(deviceId)
    }
    if (acknowledged !== undefined) {
      query += ' AND acknowledged = ?'
      params.push(acknowledged === 'true' ? 1 : 0)
    }
    
    query += ' ORDER BY timestamp DESC LIMIT 100'
    
    const rows = db.prepare(query).all(...params)
    
    const alerts = rows.map((row: any) => ({
      id: row.id,
      deviceId: row.deviceId,
      type: row.type,
      message: row.message,
      severity: row.severity,
      timestamp: row.timestamp,
      acknowledged: row.acknowledged === 1,
    }))

    res.json(alerts)
  } catch (error) {
    console.error('Error fetching alerts:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/alerts/:id/acknowledge - Acknowledge an alert
router.post('/alerts/:id/acknowledge', (req: Request, res: Response) => {
  try {
    const db = getDb()
    const result = db.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(req.params.id)
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Alert not found' })
    }
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error acknowledging alert:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/alerts/count - Get alert counts by severity
router.get('/alerts/count', (req: Request, res: Response) => {
  try {
    const db = getDb()
    const rows = db.prepare(`
      SELECT severity, COUNT(*) as count 
      FROM alerts 
      WHERE acknowledged = 0 
      GROUP BY severity
    `).all() as any[]
    
    const counts = { critical: 0, warning: 0, info: 0 }
    rows.forEach((row: any) => {
      counts[row.severity as keyof typeof counts] = row.count
    })
    
    res.json(counts)
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
