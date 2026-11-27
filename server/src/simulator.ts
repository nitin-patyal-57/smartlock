import mqtt from 'mqtt'
import { MQTT_CA, MQTT_CERT, MQTT_KEY } from './services/mqttCerts'

const AWS_IOT_ENDPOINT = process.env.MQTT_BROKER_URL || 'mqtts://avj249ldc7joq-ats.iot.ap-south-1.amazonaws.com:8883'
const IMEI = process.argv[2] || '867509082945058'

const METRICS_TOPIC = `soundbox_dev/${IMEI}/metrics`
const COMMAND_TOPIC = `soundbox_dev/${IMEI}/command`
const ACK_TOPIC = `soundbox_dev/${IMEI}/ack`
const STATUS_TOPIC = `soundbox_dev/${IMEI}/status`

console.log('='.repeat(65))
console.log('WEGW Tracker — Device Simulator (Specification 2026-11-23)')
console.log(`Target Broker : ${AWS_IOT_ENDPOINT}`)
console.log(`Device IMEI   : ${IMEI}`)
console.log(`Metrics Topic : ${METRICS_TOPIC} (every 2s)`)
console.log(`Command Topic : ${COMMAND_TOPIC}`)
console.log(`Ack Topic     : ${ACK_TOPIC}`)
console.log(`Status Topic  : ${STATUS_TOPIC}`)
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
let uptime = 389

const relays: Record<string, string> = { '1': 'off', '2': 'off' }
const leds: Record<string, string> = { red: 'auto', green: 'auto', blue: 'auto' }
let lockStatus: 'LOCKED' | 'UNLOCKED' = 'LOCKED'

client.on('connect', () => {
  console.log('[Simulator] Connected to AWS IoT Core!')

  // Publish retained online status as per SmartLock MQTT specification Topic 4
  client.publish(STATUS_TOPIC, JSON.stringify({ online: true }), { qos: 1, retain: true }, (err) => {
    if (err) console.error('[Simulator] Status publish error:', err)
    else console.log(`[Simulator] Published online status to ${STATUS_TOPIC}`)
  })

  // Subscribe to commands topic
  client.subscribe([COMMAND_TOPIC, `soundbox_dev/${IMEI}/lock/cmd`], { qos: 1 }, (err) => {
    if (err) console.error('[Simulator] Subscribe error:', err)
    else console.log(`[Simulator] Subscribed to ${COMMAND_TOPIC}`)
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
        model_id: 'WM_SB_1605',
        serial_no: '',
        app_v: 'WM_BP_2.0.8',
        sdk_v: 'WM_SDK_C_260702',
        hw_v: '',
        boot_reason: '',
        uptime_sec: ''
      },
      power: {
        bat_v: 4075,
        bat_lvl: 94,
        charging: '',
        usb: 'N',
        ext_power: '',
        ext_power_v: '',
        low_battery: ''
      },
      cellular: {
        imsi: '405867153266129',
        operator: 'JIO 4G',
        net_t: 'LTE',
        mcc: '869',
        mnc: '405',
        cell_id: '131860',
        tac: '174',
        rssi: 73,
        rsrp: 35,
        rsrq: 15,
        sinr: '',
        signal: 'EXCELLENT',
        band: '40',
        ip4: '10.38.65.70',
        ip6: '254.128.0.0.0.0.0.0.0.0.0.0.129.200.87.18'
      },
      gps: {
        status: 'FIXED',
        latitude: lat,
        longitude: lon,
        altitude_m: 315.5,
        speed_kmph: speed || 42.6,
        heading_deg: heading || 128,
        satellites: 14,
        hdop: 0.9,
        accuracy_m: 4.2,
        fix_type: '3D',
        last_fix: nowIso,
        location: 'Mohali, Punjab'
      },
      lock: {
        lock_status: lockStatus,
        door_status: 'CLOSED',
        lock_motor_status: 'OK',
        motor_current_ma: 420,
        lock_position_sensor: lockStatus,
        last_lock_time: '2026-09-15T10:20:15Z',
        last_unlock_time: '2026-09-15T09:45:10Z',
        last_unlock_method: 'REMOTE',
        unlock_count: 24,
        failed_unlock_count: 2
      },
      access: {
        keypad: {
          status: 'OK',
          enabled: true,
          failed_attempts: 0,
          last_access: '2026-09-15T08:30:12Z'
        },
        tamper: {
          tamper_status: '',
          case_open: '',
          wire_cut: '',
          lock_break: '',
          abnormal_vibration: '',
          forced_unlock: '',
          tamper_count: '',
          last_tamper_time: ''
        },
        accelerometer: {
          status: 'OK',
          motion: true,
          x_g: 0.04,
          y_g: -0.02,
          z_g: 1.01,
          harsh_braking_count: 2,
          harsh_acceleration_count: 1,
          sharp_turn_count: 3,
          impact_count: 0,
          driving_score: 91
        },
        rtc: '2026-11-17T14:12:23.433Z'
      }
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

    // Handle SmartLock Lock/Unlock Command on soundbox_dev/${IMEI}/command (or legacy lock/cmd)
    const parsedCmd = JSON.parse(raw)
    if (parsedCmd.command || parsedCmd.pin !== undefined) {
      const command = String(parsedCmd.command || '').toUpperCase()
      const pin = String(parsedCmd.pin || '').trim()

      console.log(`[Simulator Lock Cmd] command: ${command}, pin: ${pin}`)

      // Verification of PIN (Default factory PIN is 1234)
      if (pin === '1234') {
        lockStatus = command === 'UNLOCK' ? 'UNLOCKED' : 'LOCKED'
        const ack = { command, status: 'SUCCESS' }
        client.publish(ACK_TOPIC, JSON.stringify(ack), { qos: 1, retain: false })
        console.log(`[Simulator Lock Ack Sent] >> ${ACK_TOPIC}:`, ack)
      } else {
        const ack = { command, status: 'FAILED', reason: 'WRONG_PIN' }
        client.publish(ACK_TOPIC, JSON.stringify(ack), { qos: 1, retain: false })
        console.log(`[Simulator Lock Ack Sent] >> ${ACK_TOPIC}:`, ack)
      }
      return
    }

    const cmd = parsedCmd
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
