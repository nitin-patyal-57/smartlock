import mqtt from 'mqtt'
import { MQTT_CA, MQTT_CERT, MQTT_KEY } from './services/mqttCerts'

const AWS_IOT_ENDPOINT = process.env.MQTT_BROKER_URL || 'mqtts://avj249ldc7joq-ats.iot.ap-south-1.amazonaws.com:8883'
const IMEI = process.argv[2] || '861185084122719'
const UPLINK_TOPIC = `wegw/${IMEI}/gps/nmea`
const DOWNLINK_TOPIC = `wegw/${IMEI}/gps/cmd`

function nmeaChecksum(str: string): string {
  let c = 0
  for (let i = 0; i < str.length; i++) {
    c ^= str.charCodeAt(i)
  }
  return c.toString(16).toUpperCase().padStart(2, '0')
}

function toNmeaCoords(lat: number, lon: number): [string, string, string, string] {
  const latDir = lat >= 0 ? 'N' : 'S'
  const absLat = Math.abs(lat)
  const latDeg = Math.floor(absLat)
  const latMin = (absLat - latDeg) * 60
  const latStr = `${latDeg.toString().padStart(2, '0')}${latMin.toFixed(4).padStart(7, '0')}`

  const lonDir = lon >= 0 ? 'E' : 'W'
  const absLon = Math.abs(lon)
  const lonDeg = Math.floor(absLon)
  const lonMin = (absLon - lonDeg) * 60
  const lonStr = `${lonDeg.toString().padStart(3, '0')}${lonMin.toFixed(4).padStart(7, '0')}`

  return [latStr, latDir, lonStr, lonDir]
}

function generateNmea(lat: number, lon: number, speedKmh: number, heading: number): string {
  const now = new Date()
  const timeStr = now.toISOString().substring(11, 19).replace(/:/g, '') + '.00'
  const day = now.getUTCDate().toString().padStart(2, '0')
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0')
  const year = now.getUTCFullYear().toString().slice(-2)
  const dateStr = `${day}${month}${year}`

  const [latStr, latDir, lonStr, lonDir] = toNmeaCoords(lat, lon)
  const speedKnots = (speedKmh / 1.852).toFixed(2)

  const ggaBody = `GNGGA,${timeStr},${latStr},${latDir},${lonStr},${lonDir},1,09,1.1,314.5,M,-35.0,M,,`
  const gga = `$${ggaBody}*${nmeaChecksum(ggaBody)}`

  const rmcBody = `GNRMC,${timeStr},A,${latStr},${latDir},${lonStr},${lonDir},${speedKnots},${heading.toFixed(1)},${dateStr},,,A`
  const rmc = `$${rmcBody}*${nmeaChecksum(rmcBody)}`

  const gsaBody = `GNGSA,A,3,01,03,06,09,14,17,19,22,28,,,,2.1,1.1,1.8`
  const gsa = `$${gsaBody}*${nmeaChecksum(gsaBody)}`

  return `${gga}\r\n${rmc}\r\n${gsa}\r\n`
}

console.log('=' .repeat(65))
console.log('SmartLock Server Device Simulator')
console.log(`Target Broker : ${AWS_IOT_ENDPOINT}`)
console.log(`Device IMEI   : ${IMEI}`)
console.log(`Uplink Topic  : ${UPLINK_TOPIC}`)
console.log(`Downlink Topic: ${DOWNLINK_TOPIC}`)
console.log('='.repeat(65))

const clientId = `sim_device_${IMEI.slice(-6)}_${Math.random().toString(16).substring(2, 6)}`
const client = mqtt.connect(AWS_IOT_ENDPOINT, {
  clientId,
  ca: MQTT_CA,
  cert: MQTT_CERT,
  key: MQTT_KEY,
  rejectUnauthorized: true,
  protocol: 'mqtts',
  keepalive: 60
})

let t = 0
const baseLat = 30.704648
const baseLon = 76.717871
let speed = 35.0

client.on('connect', () => {
  console.log('[Simulator] Connected to AWS IoT Core!')
  client.subscribe(DOWNLINK_TOPIC, { qos: 1 }, (err) => {
    if (err) console.error('[Simulator] Subscribe error:', err)
    else console.log(`[Simulator] Subscribed to commands on ${DOWNLINK_TOPIC}`)
  })

  setInterval(() => {
    const lat = baseLat + 0.005 * Math.sin(t)
    const lon = baseLon + 0.007 * Math.cos(t)
    const heading = ((Math.atan2(-0.007 * Math.sin(t), 0.005 * Math.cos(t)) * 180 / Math.PI) + 360) % 360

    const nmea = generateNmea(lat, lon, speed, heading)
    client.publish(UPLINK_TOPIC, nmea, { qos: 0 })
    console.log(`[Sent Telemetry] Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}, Heading: ${heading.toFixed(1)}°`)

    t += 0.05
  }, 1000)
})

client.on('message', (topic, payload) => {
  console.log(`[Simulator Received Command] << ${topic}: ${payload.toString()}`)
})

client.on('error', (err) => {
  console.error('[Simulator Error]:', err.message)
})
