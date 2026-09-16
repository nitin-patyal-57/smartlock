# Smart Lock Monitoring Dashboard

A complete IoT monitoring system: **Smart Lock Device → Server → Real-time Dashboard**.

## System Architecture

```
Smart Lock Device(s)          Server                    Dashboard
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ Sends JSON   │──POST──▶│ Node.js +    │──REST──▶│ React +      │
│ every 1-5s   │         │ Express +    │         │ TypeScript + │
│              │         │ SQLite +     │◀──WS────│ Tailwind +   │
│ GPS, Battery,│         │ WebSocket    │         │ Leaflet Map  │
│ Lock, Signal │         │              │         │ Recharts     │
└──────────────┘         └──────────────┘         └──────────────┘
```

## Quick Start (3 terminals)

### Terminal 1: Start the Server
```bash
cd server
npm install
npm run dev
# Server runs at http://localhost:3001
```

### Terminal 2: Start the Dashboard
```bash
npm install
npm run dev
# Dashboard runs at http://localhost:3000
```

### Terminal 3: Start the Device Simulator
```bash
cd simulator
node device-simulator.js
# Simulates 8 devices sending data every 1-5 seconds
```

Open `http://localhost:3000` to see the dashboard with live data!

## Project Structure

```
SmartLockDashboard/
├── src/                          # Dashboard (React + Vite)
│   ├── components/
│   │   ├── layout/               # Sidebar, Header, Layout
│   │   └── ui/                   # Reusable UI components
│   ├── context/                  # ThemeContext (dark/light)
│   ├── hooks/                    # Data fetching hooks
│   ├── pages/                    # 10 page components
│   ├── services/
│   │   ├── config.ts             # API/WS configuration
│   │   ├── deviceService.ts      # Data access layer (mock ↔ real)
│   │   ├── firebase.ts           # (placeholder for Firebase)
│   │   └── websocket.ts          # WebSocket client
│   ├── types/                    # TypeScript interfaces
│   └── utils/                    # Helper functions
│
├── server/                       # Backend (Node.js + Express)
│   ├── src/
│   │   ├── index.ts              # Express server entry
│   │   ├── routes/
│   │   │   ├── devices.ts        # Device telemetry + queries
│   │   │   ├── alerts.ts         # Alert management
│   │   │   └── activity.ts       # Activity events
│   │   ├── services/
│   │   │   ├── database.ts       # SQLite setup + queries
│   │   │   └── websocket.ts      # WebSocket broadcast
│   │   └── middleware/
│   │       └── auth.ts           # API key auth
│   ├── data/                     # SQLite database (auto-created)
│   ├── .env                      # Server configuration
│   └── package.json
│
└── simulator/                    # Device Simulator
    ├── device-simulator.js       # Simulates 8 smart locks
    └── package.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/devices/:id/telemetry` | Device sends telemetry data |
| `GET` | `/api/devices` | Get all devices (latest state) |
| `GET` | `/api/devices/:id` | Get single device |
| `GET` | `/api/devices/:id/history` | Location history (supports `?from=&to=`) |
| `POST` | `/api/devices/:id/offline` | Mark device offline |
| `GET` | `/api/alerts` | Get alerts (supports `?severity=&deviceId=`) |
| `POST` | `/api/alerts/:id/acknowledge` | Acknowledge alert |
| `GET` | `/api/alerts/count` | Alert counts by severity |
| `GET` | `/api/activity` | Activity events |
| `POST` | `/api/activity` | Create activity event |
| `GET` | `/api/health` | Server health check |
| `WS` | `ws://localhost:3001/ws` | Real-time device updates |

## Device Data Format

The device sends JSON matching this structure (sent via HTTP POST):

```json
{
  "device": {
    "imei": "356938035643809",
    "modelId": "SL-PRO-200",
    "serialNumber": "SN-FL-2024-001",
    "appVersion": "2.4.1",
    "sdkVersion": "1.8.3",
    "hardwareVersion": "HW3.2",
    "bootReason": "power_on",
    "uptime": 345600
  },
  "power": {
    "batteryVoltage": 4.15,
    "batteryPercentage": 89,
    "isCharging": false,
    "isUsbConnected": false,
    "isExternalPower": false,
    "isLowBattery": false
  },
  "cellular": {
    "operator": "T-Mobile",
    "networkType": "LTE-M",
    "rssi": -72,
    "signalQuality": 85,
    "ip": "10.24.36.112"
  },
  "gps": {
    "isFixed": true,
    "latitude": 39.7684,
    "longitude": -86.1581,
    "altitude": 218,
    "speed": 0,
    "heading": 0,
    "satellites": 12,
    "hdop": 1.2,
    "accuracy": 4.5,
    "lastFix": "2026-09-16T10:00:00Z",
    "lastLocation": "Indianapolis, IN"
  },
  "lock": {
    "lockStatus": true,
    "doorStatus": false,
    "motorStatus": "idle",
    "motorCurrent": 0,
    "positionSensor": true,
    "lastLockTime": "2026-09-16T08:00:00Z",
    "lastUnlockTime": "2026-09-16T07:00:00Z",
    "unlockMethod": "keypad",
    "unlockCount": 142,
    "failedUnlockCount": 2
  }
}
```

## Auto-Generated Alerts

The server automatically creates alerts when it receives data with:
- Battery < 20% → `low_battery` alert
- Tamper status active → `tamper_detected` alert
- Forced unlock → `forced_unlock` alert
- Wire cut → `wire_cut` alert
- Case opened → `case_open` alert
- Lock break → `lock_break` alert
- Abnormal vibration → `abnormal_vibration` alert
- Geofence violation → `geofence_violation` alert
- Overspeed → `overspeed` alert

## Configuration

### Server (.env)
```
PORT=3001
API_KEY=smartlock-dev-key-2024
DATABASE_PATH=./data/smartlock.db
CORS_ORIGIN=http://localhost:3000
```

### Dashboard (.env in root)
```
VITE_API_BASE_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001/ws
VITE_API_KEY=smartlock-dev-key-2024
VITE_USE_MOCK_DATA=false
```

## Mock vs Real Data

The dashboard automatically falls back to mock data if the server is unavailable.
To force mock data mode, set `VITE_USE_MOCK_DATA=true` in the root `.env`.

## Simulator Options

```bash
# Default (localhost:3001, 2s interval)
node device-simulator.js

# Custom server
node device-simulator.js --server http://your-server:3001

# Custom interval (1 second)
node device-simulator.js --interval 1000
```

## Tech Stack

**Dashboard:** React 19, TypeScript, Vite 8, Tailwind CSS v4, React Router v7, Recharts, Leaflet, Lucide React

**Server:** Node.js, Express, SQLite (better-sqlite3), WebSocket (ws)

**Simulator:** Node.js (no dependencies)

## License

MIT
