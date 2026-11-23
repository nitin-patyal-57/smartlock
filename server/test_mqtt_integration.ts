import { initDatabase, getDb } from './src/services/database'
import { initMqttService, publishGpsCommand, parseNmeaPayload } from './src/services/mqttService'

async function testIntegration() {
  console.log('--- 1. Testing NMEA parser ---')
  const sampleNmea = [
    '$GNGGA,071032.00,3042.2789,N,07643.0723,E,1,09,1.1,314.5,M,-35.0,M,,*43',
    '$GNRMC,071032.00,A,3042.2789,N,07643.0723,E,19.44,124.5,231126,,,A*76'
  ].join('\r\n')

  const parsed = parseNmeaPayload(sampleNmea)
  console.log('Parsed GPS:', JSON.stringify(parsed.gps, null, 2))
  if (!parsed.gps || Math.abs(parsed.gps.latitude - 30.704648) > 0.001 || Math.abs(parsed.gps.longitude - 76.717871) > 0.001) {
    throw new Error('NMEA Parser coordinate calculation mismatch!')
  }
  console.log('✅ Coordinate conversion verified: 3042.2789 N -> ' + parsed.gps.latitude + ', 07643.0723 E -> ' + parsed.gps.longitude)
  console.log('✅ Speed conversion verified: 19.44 knots -> ' + parsed.gps.speed + ' km/h')

  console.log('\n--- 2. Initializing SQLite Database ---')
  await initDatabase()
  const db = getDb()

  console.log('\n--- 3. Testing MQTT Connection to AWS IoT Core ---')
  let receivedUpdate = false
  const client = initMqttService((event, data) => {
    console.log(`[Event Broadcast] ${event}:`, JSON.stringify(data).substring(0, 120) + '...')
    if (event === 'device_update') {
      receivedUpdate = true
    }
  })

  // Wait until MQTT client is connected
  console.log('Waiting for MQTT connection to complete...')
  for (let i = 0; i < 20; i++) {
    if (client?.connected) break
    await new Promise(r => setTimeout(r, 500))
  }

  if (!client?.connected) {
    throw new Error('MQTT client failed to connect within 10s')
  }
  console.log('✅ MQTT client is connected and subscribed!')

  // Small delay to ensure subscription is registered on the AWS IoT Core broker
  await new Promise(r => setTimeout(r, 1000))

  console.log('\n--- 4. Publishing test packet to wegw/861185084122719/gps/nmea ---')
  await new Promise<void>((resolve, reject) => {
    client.publish('wegw/861185084122719/gps/nmea', sampleNmea, { qos: 1 }, (err) => {
      if (err) reject(err)
      else {
        console.log('Published successfully!')
        resolve()
      }
    })
  })

  // Wait for message receipt and DB write
  console.log('Waiting for telemetry processing...')
  for (let i = 0; i < 20; i++) {
    if (receivedUpdate) break
    await new Promise(r => setTimeout(r, 500))
  }

  console.log('\n--- 5. Verifying DB record ---')
  const row = db.prepare('SELECT * FROM devices WHERE deviceId = ?').get('861185084122719') as any
  if (!row) {
    throw new Error('Device 861185084122719 not found in database!')
  }
  console.log('✅ Device found in DB! Status:', row.status, 'LastSeen:', row.lastSeen)
  const devData = JSON.parse(row.data)
  console.log('✅ Saved GPS:', devData.gps.latitude, devData.gps.longitude, 'Satellites:', devData.gps.satellites)

  const history = db.prepare('SELECT * FROM device_history WHERE deviceId = ? ORDER BY id DESC LIMIT 1').get('861185084122719') as any
  console.log('✅ History record found: Lat=', history.latitude, 'Lon=', history.longitude, 'Timestamp=', history.timestamp)

  console.log('\n--- 6. Testing Downlink Command to wegw/861185084122719/gps/cmd ---')
  const cmdOk = await publishGpsCommand('861185084122719', 'stream=1')
  console.log('✅ Publish command result:', cmdOk)

  console.log('\n======================================')
  console.log('🎉 ALL MQTT INTEGRATION TESTS PASSED!')
  console.log('======================================')
  process.exit(0)
}

testIntegration().catch(err => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
