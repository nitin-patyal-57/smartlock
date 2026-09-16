import { onRequest } from "firebase-functions/v2/https";
import { initializeApp, getApps } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp();
}

const db = getDatabase();
const corsHandler = cors({ origin: true });

// Helper: generate alerts based on device data
function generateAlerts(deviceId: string, data: any): Array<{id: string, deviceId: string, type: string, message: string, severity: string, timestamp: string}> {
  const alerts: Array<{id: string, deviceId: string, type: string, message: string, severity: string, timestamp: string}> = [];
  const now = new Date().toISOString();

// Helper: generate alerts based on device data
function generateAlerts(deviceId: string, data: any): Array<{id: string, deviceId: string, type: string, message: string, severity: string, timestamp: string}> {
  const alerts: Array<{id: string, deviceId: string, type: string, message: string, severity: string, timestamp: string}> = [];
  const now = new Date().toISOString();

  if (data.power?.batteryPercentage !== undefined && data.power.batteryPercentage < 20) {
    alerts.push({
      id: uuidv4(), deviceId, type: 'low_battery',
      message: `Low battery: ${data.power.batteryPercentage}% on device ${deviceId}`,
      severity: data.power.batteryPercentage < 10 ? 'critical' : 'warning',
      timestamp: now
    });
  }
  if (data.tamper?.tamperStatus) {
    alerts.push({ id: uuidv4(), deviceId, type: 'tamper_detected', message: `Tamper alert on device ${deviceId}`, severity: 'critical', timestamp: now });
  }
  if (data.tamper?.forcedUnlock) {
    alerts.push({ id: uuidv4(), deviceId, type: 'forced_unlock', message: `Forced unlock on device ${deviceId}`, severity: 'critical', timestamp: now });
  }
  if (data.tamper?.wireCut) {
    alerts.push({ id: uuidv4(), deviceId, type: 'wire_cut', message: `Wire cut on device ${deviceId}`, severity: 'critical', timestamp: now });
  }
  if (data.tamper?.caseOpen) {
    alerts.push({ id: uuidv4(), deviceId, type: 'case_open', message: `Case opened on device ${deviceId}`, severity: 'critical', timestamp: now });
  }
  if (data.tamper?.lockBreak) {
    alerts.push({ id: uuidv4(), deviceId, type: 'lock_break', message: `Lock break on device ${deviceId}`, severity: 'critical', timestamp: now });
  }
  if (data.tamper?.abnormalVibration) {
    alerts.push({ id: uuidv4(), deviceId, type: 'abnormal_vibration', message: `Abnormal vibration on device ${deviceId}`, severity: 'warning', timestamp: now });
  }
  if (data.geofence?.violation) {
    alerts.push({ id: uuidv4(), deviceId, type: 'geofence_violation', message: `Geofence violation on device ${deviceId}`, severity: 'warning', timestamp: now });
  }
  if (data.trip?.overspeedCount > 0) {
    alerts.push({ id: uuidv4(), deviceId, type: 'overspeed', message: `Overspeed on device ${deviceId}`, severity: 'warning', timestamp: now });
  }

  return alerts;
}

// Main API Cloud Function
export const api = onRequest({ region: "asia-southeast1" }, async (req, res) => {
  return corsHandler(req, res, async () => {
    const path = req.path;
    const method = req.method;

    try {
      // Health check
      if (path === '/health' && method === 'GET') {
        res.json({ status: 'ok', timestamp: new Date().toISOString(), runtime: 'firebase-functions' });
        return;
      }

      // POST /devices/:id/telemetry - Device sends data
      const telemetryMatch = path.match(/^\/devices\/([^/]+)\/telemetry$/);
      if (telemetryMatch && method === 'POST') {
        const deviceId = telemetryMatch[1];
        const data = req.body;
        const now = new Date().toISOString();

        // Save latest device state
        await db.ref(`smartlock/devices/${deviceId}`).set({
          deviceId,
          deviceName: data.deviceName || data.device?.modelId || deviceId,
          status: 'online',
          lastSeen: now,
          data: data,
          updatedAt: now
        });

        // Save to history (GPS + battery snapshot)
        if (data.gps) {
          const historyRef = db.ref(`smartlock/history/${deviceId}`);
          await historyRef.push({
            latitude: data.gps.latitude || 0,
            longitude: data.gps.longitude || 0,
            altitude: data.gps.altitude || 0,
            speed: data.gps.speed || 0,
            heading: data.gps.heading || 0,
            accuracy: data.gps.accuracy || 0,
            batteryPercentage: data.power?.batteryPercentage || 0,
            batteryVoltage: data.power?.batteryVoltage || 0,
            lockStatus: data.lock?.lockStatus || false,
            doorStatus: data.lock?.doorStatus || false,
            signalQuality: data.cellular?.signalQuality || 0,
            rssi: data.cellular?.rssi || 0,
            timestamp: now
          });
        }

        // Auto-generate alerts
        const alerts = generateAlerts(deviceId, data);
        for (const alert of alerts) {
          await db.ref(`smartlock/alerts/${alert.id}`).set(alert);
        }

        // Log activity for lock/unlock events
        if (data.lock) {
          const eventType = data.lock.lockStatus ? 'lock' : 'unlock';
          await db.ref(`smartlock/activity/${uuidv4()}`).set({
            deviceId,
            type: eventType,
            message: `Device ${eventType === 'lock' ? 'locked' : 'unlocked'} via ${data.lock.unlockMethod || 'unknown'}`,
            timestamp: now,
            metadata: { method: data.lock.unlockMethod }
          });
        }

        res.json({ success: true, deviceId, timestamp: now });
        return;
      }

      // GET /devices - Get all devices
      if (path === '/devices' && method === 'GET') {
        const snapshot = await db.ref('smartlock/devices').once('value');
        const devices: any[] = [];
        snapshot.forEach((child: any) => {
          const val = child.val();
          devices.push({
            ...val.data,
            status: val.status,
            lastSeen: val.lastSeen,
            deviceId: val.deviceId,
            deviceName: val.deviceName
          });
        });
        res.json(devices);
        return;
      }

      // GET /devices/:id - Get single device
      const deviceMatch = path.match(/^\/devices\/([^/]+)$/);
      if (deviceMatch && method === 'GET' && !path.includes('/history')) {
        const snapshot = await db.ref(`smartlock/devices/${deviceMatch[1]}`).once('value');
        if (!snapshot.exists()) {
          res.status(404).json({ error: 'Device not found' });
          return;
        }
        const val = snapshot.val();
        res.json({
          ...val.data,
          status: val.status,
          lastSeen: val.lastSeen,
          deviceId: val.deviceId,
          deviceName: val.deviceName
        });
        return;
      }

      // GET /devices/:id/history - Location history
      const historyMatch = path.match(/^\/devices\/([^/]+)\/history$/);
      if (historyMatch && method === 'GET') {
        const deviceId = historyMatch[1];
        const { from, to } = req.query;
        
        let query = db.ref(`smartlock/history/${deviceId}`).orderByChild('timestamp');
        if (from) query = query.startAt(from as string);
        if (to) query = query.endAt(to as string);
        
        const snapshot = await query.once('value');
        const history: any[] = [];
        snapshot.forEach((child: any) => {
          const val = child.val();
          history.push({
            id: child.key,
            deviceId,
            ...val,
            lockStatus: val.lockStatus === true,
            isFixed: true
          });
        });
        res.json(history);
        return;
      }

      // GET /alerts - Get alerts
      if (path === '/alerts' && method === 'GET') {
        const { severity, deviceId } = req.query;
        let query: any = db.ref('smartlock/alerts').orderByChild('timestamp');
        
        const snapshot = await query.once('value');
        let alerts: any[] = [];
        snapshot.forEach((child: any) => {
          const val = child.val();
          alerts.push(val);
        });
        
        if (severity) alerts = alerts.filter(a => a.severity === severity);
        if (deviceId) alerts = alerts.filter(a => a.deviceId === deviceId);
        
        alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        res.json(alerts.slice(0, 100));
        return;
      }

      // POST /alerts/:id/acknowledge
      const ackMatch = path.match(/^\/alerts\/([^/]+)\/acknowledge$/);
      if (ackMatch && method === 'POST') {
        await db.ref(`smartlock/alerts/${ackMatch[1]}/acknowledged`).set(true);
        res.json({ success: true });
        return;
      }

      // GET /activity - Activity events
      if (path === '/activity' && method === 'GET') {
        const { deviceId } = req.query;
        let query: any = db.ref('smartlock/activity').orderByChild('timestamp');
        
        const snapshot = await query.once('value');
        let events: any[] = [];
        snapshot.forEach((child: any) => {
          events.push(child.val());
        });
        
        if (deviceId) events = events.filter(e => e.deviceId === deviceId);
        
        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        res.json(events.slice(0, 100));
        return;
      }

      // POST /activity - Create activity event
      if (path === '/activity' && method === 'POST') {
        const { deviceId, type, message, metadata } = req.body;
        const id = uuidv4();
        const now = new Date().toISOString();
        await db.ref(`smartlock/activity/${id}`).set({ id, deviceId, type, message, timestamp: now, metadata });
        res.json({ id, deviceId, type, message, timestamp: now, metadata });
        return;
      }

      // 404
      res.status(404).json({ error: 'Not found', path });
    } catch (error) {
      console.error('API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});
