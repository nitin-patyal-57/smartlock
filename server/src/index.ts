import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { initDatabase } from './services/database'
import deviceRoutes from './routes/devices'
import alertRoutes from './routes/alerts'
import activityRoutes from './routes/activity'
import { broadcast, addClient } from './services/websocket'
import { initMqttService, getMqttStatus } from './services/mqttService'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

// Middleware
app.use(cors({
  origin: true, // Allow all origins (Vercel, Firebase, localhost, etc.)
  credentials: true
}))
app.use(express.json({ limit: '50mb' }))

// Serve static frontend assets from public/
const publicDir = path.join(__dirname, '../public')
app.use(express.static(publicDir))

// API Routes
app.use('/api', deviceRoutes)
app.use('/api', alertRoutes)
app.use('/api', activityRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mqtt: getMqttStatus()
  })
})

// Single Page Application (SPA) fallback: serves the full Dashboard UI
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next()
  }
  const indexPath = path.join(publicDir, 'index.html')
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath)
  } else {
    res.json({
      service: 'SmartLock MQTT Backend API',
      status: 'online',
      mqtt: getMqttStatus(),
      endpoints: {
        devices: '/api/devices',
        health: '/api/health',
        websocket: '/ws'
      }
    })
  }
})

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('WebSocket client connected')
  addClient(ws)
})

// Make broadcast available to routes
app.set('broadcast', broadcast)

// Initialize database and start server
const PORT = process.env.PORT || 3001

initDatabase().then(() => {
  // Start MQTT background bridge
  initMqttService(broadcast)

  server.listen(PORT, () => {
    console.log(`SmartLock Server running on port ${PORT}`)
    console.log(`Dashboard UI: http://localhost:${PORT}`)
    console.log(`API Health: http://localhost:${PORT}/api/health`)
    console.log(`WebSocket server on ws://localhost:${PORT}/ws`)
  })
}).catch((err) => {
  console.error('Failed to initialize database:', err)
  process.exit(1)
})
