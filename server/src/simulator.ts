import mqtt from 'mqtt'
import { MQTT_CA, MQTT_CERT, MQTT_KEY } from './services/mqttCerts'

const AWS_IOT_ENDPOINT = process.env.MQTT_BROKER_URL || 'mqtts://avj249ldc7joq-ats.iot.ap-south-1.amazonaws.com:8883'
const IMEI = process.argv[2] || '861185084122719'

const METRICS_TOPIC = `soundbox_dev/${IMEI}/metrics`
const COMMAND_TOPIC = `soundbox_dev/${IMEI}/command`
const ACK_TOPIC = `soundbox_dev/${IMEI}/ack`

console.log('='.repeat(65))
console.log('WEGW Tracker — Device Simulator (Specification 2026-11-23)')
console.log(`Target Broker : ${AWS_IOT_ENDPOINT}`)
console.log(`Device IMEI   : ${IMEI}`)
console.log(`Metrics Topic : ${METRICS_TOPIC} (every 2s)`)
console.log(`Command Topic : ${COMMAND_TOPIC}`)
console.log(`Ack Topic     : ${ACK_TOPIC}`)
console.log('='.repeat(65))

const clientId = `wegw-${IMEI}`
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
const baseLat = 30.704649
const baseLon = 76.717873
let speed = 42.6
let uptime = 100

const relays: Record<string, string> = { '1': 'off', '2': 'off' }
const leds: Record<string, string> = { red: 'auto', green: 'auto', blue: 'auto' }

client.on('connect', () => {
  console.log('[Simulator] Connected to AWS IoT Core!')
  client.subscribe(COMMAND_TOPIC, { qos: 1 }, (err) => {
    if (err) console.error('[Simulator] Subscribe error:', err)
    else console.log(`[Simulator] Subscribed to commands on ${COMMAND_TOPIC}`)
  })

  // Transmit metrics every 2s as specified
  setInterval(() => {
    const lat = Number((baseLat + 0.005 * Math.sin(t)).toFixed(6))
    const lon = Number((baseLon + 0.007 * Math.cos(t)).toFixed(6))
    const heading = Math.round(((Math.atan2(-0.007 * Math.sin(t), 0.005 * Math.cos(t)) * 180 / Math.PI) + 360) % 360)
    uptime += 2

    const now = new Date()
    const nowIso = now.toISOString()

    const metrics = {
      device: {
        imei: IMEI,
        model_id: 'GW1NS-4',
        serial_no: `SN-${IMEI.slice(-6)}`,
        app_v: 'WM_BP_2.0.8',
        sdk_v: 'WM_SDK_C_260702',
        hw_v: 'Z636_V1',
        boot_reason: 'power on',
        uptime_sec: uptime
      },
      power: {
        bat_v: 4075,
        bat_lvl: 94,
        charging: 'N',
        usb: 'N',
        ext_power: 'N',
        ext_power_v: '',
        low_battery: false
      },
      cellular: {
        imsi: '405867153266129',
        operator: 'JIO 4G',
        net_t: 'LTE',
        mcc: '405',
        mnc: '86',
        cell_id: '131860',
        tac: '174',
        rssi: -73,
        rsrp: -95,
        rsrq: -11,
        sinr: 12,
        signal: 'GOOD',
        band: '40',
        ip4: '10.38.65.70',
        ip6: ''
      },
      gps: {
        status: 'FIXED',
        latitude: lat,
        longitude: lon,
        altitude_m: 315.5,
        speed_kmph: speed,
        heading_deg: heading,
        satellites: 14,
        hdop: 0.9,
        accuracy_m: 4.5,
        fix_type: '3D',
        last_fix: nowIso,
        location: ''
      },
      accelerometer: {
        status: 'OK',
        motion: true,
        x_g: 0.041,
        y_g: -0.02,
        z_g: 1.012,
        harsh_braking_count: 0,
        harsh_acceleration_count: 0,
        sharp_turn_count: 0,
        impact_count: 0,
        driving_score: ''
      },
      rtc: nowIso
    }

    const payload = JSON.stringify(metrics)
    client.publish(METRICS_TOPIC, payload, { qos: 0, retain: false })
    console.log(`[Metrics Sent] Lat: ${lat}, Lon: ${lon}, Speed: ${speed} km/h, Heading: ${heading}°`)

    t += 0.05
  }, 2000)
})

client.on('message', (topic, payload) => {
  try {
    const raw = payload.toString('utf-8')
    console.log(`[Command Received] << ${topic}: ${raw}`)
    const cmd = JSON.parse(raw)
    const ack: any = { id: cmd.id || '', cmd: cmd.cmd || '' }

    if (cmd.cmd === 'relay') {
      const r = String(cmd.relay)
      if (['1', '2'].includes(r) && ['on', 'off'].includes(cmd.state)) {
        relays[r] = cmd.state
        ack.result = 'ok'
      } else {
        ack.result = 'error'
        ack.error = 'relay must be 1 or 2'
      }
    } else if (cmd.cmd === 'led') {
      const l = cmd.led
      if (['red', 'green', 'blue', 'all'].includes(l) && ['on', 'off', 'blink', 'auto'].includes(cmd.state)) {
        if (l === 'all') {
          for (const k of Object.keys(leds)) leds[k] = cmd.state
        } else {
          leds[l] = cmd.state
        }
        ack.result = 'ok'
      } else {
        ack.result = 'error'
        ack.error = 'bad led parameters'
      }
    } else if (cmd.cmd === 'status') {
      ack.result = 'ok'
    } else {
      ack.result = 'error'
      ack.error = 'cmd must be relay, led or status'
    }

    ack.relays = { ...relays }
    ack.leds = { ...leds }

    const ackStr = JSON.stringify(ack)
    client.publish(ACK_TOPIC, ackStr, { qos: 1, retain: false })
    console.log(`[Ack Sent] >> ${ACK_TOPIC}: ${ackStr}`)
  } catch (err: any) {
    console.error('[Error handling command]:', err.message)
  }
})

client.on('error', (err) => {
  console.error('[Simulator Error]:', err.message)
})
