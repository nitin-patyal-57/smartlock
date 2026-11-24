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
const baseLat = 30.657035
const baseLon = 76.729596
let speed = 0
let uptime = 389

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
    const lat = Number((baseLat + (speed > 0 ? 0.002 * Math.sin(t) : 0)).toFixed(6))
    const lon = Number((baseLon + (speed > 0 ? 0.003 * Math.cos(t) : 0)).toFixed(6))
    const heading = speed > 0 ? Math.round(((Math.atan2(-0.003 * Math.sin(t), 0.002 * Math.cos(t)) * 180 / Math.PI) + 360) % 360) : 183
    uptime += 2

    const now = new Date()
    const nowIso = now.toISOString()

    const metrics = {
      device: {
        imei: IMEI,
        model_id: 'GW1NS-4',
        serial_no: `SN-${IMEI.slice(-6)}`,
        app_v: 'WMZ_DEV_1.0.2',
        sdk_v: 'WM_SDK_C_261008',
        hw_v: 'Z636_V1',
        boot_reason: 'power-off charging',
        uptime_sec: uptime
      },
      power: {
        bat_v: 4222,
        bat_lvl: 100,
        charging: 'Y',
        usb: 'Y',
        ext_power: 'Y',
        ext_power_v: '',
        low_battery: false
      },
      cellular: {
        imsi: '404022437552332',
        operator: 'IND airtel',
        net_t: 'LTE',
        mcc: '404',
        mnc: '02',
        cell_id: '128026133',
        tac: '7911',
        rssi: 29,
        rsrp: 52,
        rsrq: 13,
        sinr: -4,
        signal: 'EXCELLENT',
        band: '3',
        ip4: '172.18.222.207',
        ip6: '254.128.0.0.0.0.0.0.0.0.0.0.20.235.208.251'
      },
      gps: {
        status: 'FIXED',
        latitude: lat,
        longitude: lon,
        altitude_m: 301.7,
        speed_kmph: speed,
        heading_deg: heading,
        satellites: 29,
        hdop: 0.6,
        accuracy_m: 2.9,
        fix_type: '3D',
        last_fix: nowIso,
        location: ''
      },
      accelerometer: {
        status: 'OK',
        motion: speed > 0,
        x_g: -0.008,
        y_g: 0.008,
        z_g: -1.043,
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
