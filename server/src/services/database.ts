import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export async function initDatabase(): Promise<void> {
  const dbDir = path.join(process.cwd(), 'data')
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  const dbPath = process.env.DATABASE_PATH || path.join(dbDir, 'smartlock.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      deviceId TEXT PRIMARY KEY,
      deviceName TEXT,
      status TEXT DEFAULT 'offline',
      lastSeen TEXT,
      data TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS device_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deviceId TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      altitude REAL,
      speed REAL,
      heading REAL,
      accuracy REAL,
      batteryPercentage INTEGER,
      batteryVoltage REAL,
      lockStatus INTEGER,
      doorStatus INTEGER,
      signalQuality INTEGER,
      rssi INTEGER,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (deviceId) REFERENCES devices(deviceId)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      deviceId TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      acknowledged INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity (
      id TEXT PRIMARY KEY,
      deviceId TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_history_device ON device_history(deviceId);
    CREATE INDEX IF NOT EXISTS idx_history_timestamp ON device_history(timestamp);
    CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(deviceId);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
    CREATE INDEX IF NOT EXISTS idx_activity_device ON activity(deviceId);
    CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity(timestamp);
  `)

  // Migration: clean up any legacy SmartLock-<last4> device names to IMEI
  try {
    db.prepare("UPDATE devices SET deviceName = deviceId WHERE deviceName LIKE 'SmartLock-%'").run()
    const rows = db.prepare("SELECT deviceId, data FROM devices WHERE deviceName = deviceId").all() as { deviceId: string; data: string }[]
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.data)
        if (parsed.deviceName && parsed.deviceName.toLowerCase().startsWith('smartlock-')) {
          parsed.deviceName = row.deviceId
          db.prepare("UPDATE devices SET data = ? WHERE deviceId = ?").run(JSON.stringify(parsed), row.deviceId)
        }
      } catch {}
    }
  } catch {}

  console.log('Database initialized successfully')
}
