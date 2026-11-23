import express from 'express'
import cors from 'cors'
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

// Routes
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
    console.log(`SmartLock Server running on http://localhost:${PORT}`)
    console.log(`WebSocket server on ws://localhost:${PORT}/ws`)
    console.log(`API docs: http://localhost:${PORT}/api/health`)
  })
}).catch((err) => {
  console.error('Failed to initialize database:', err)
  process.exit(1)
})
