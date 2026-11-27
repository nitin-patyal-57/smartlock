import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { initDatabase } from './services/database'
import { broadcast, addClient } from './services/websocket'
import { initMqttService, getMqttStatus } from './services/mqttService'

const app = express()
const server = createServer(app)
// Dashboard <-> server traffic is WebSocket-only; keep frames small.
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 256 * 1024 })

// Middleware
app.use(cors({
  origin: true, // Allow all origins (Render, Vercel, localhost, etc.)
  credentials: true
}))

// Serve static frontend assets from public/
const publicDir = path.join(__dirname, '../public')
app.use(express.static(publicDir))

// Health check (ops only - the dashboard itself talks exclusively over /ws)
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
      service: 'SmartLock MQTT Bridge',
      status: 'online',
      mqtt: getMqttStatus(),
      websocket: '/ws'
    })
  }
})

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('WebSocket client connected')
  addClient(ws)
})

// Initialize database and start server
const PORT = process.env.PORT || 3001

initDatabase().then(() => {
  // Start MQTT background bridge
  initMqttService(broadcast)

  server.listen(PORT, () => {
    console.log(`SmartLock Server running on port ${PORT}`)
    console.log(`Dashboard UI: http://localhost:${PORT}`)
    console.log(`Health: http://localhost:${PORT}/api/health`)
    console.log(`WebSocket server on ws://localhost:${PORT}/ws`)
  })
}).catch((err) => {
  console.error('Failed to initialize database:', err)
  process.exit(1)
})
