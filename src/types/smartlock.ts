export interface DeviceInfo {
  imei: string;
  modelId: string;
  serialNumber: string;
  appVersion: string;
  sdkVersion: string;
  hardwareVersion: string;
  bootReason: string;
  uptime: number;
}

export interface PowerInfo {
  batteryVoltage: number;
  batteryPercentage: number;
  isCharging: boolean;
  isUsbConnected: boolean;
  isExternalPower: boolean;
  isLowBattery: boolean;
  batteryMv?: number;
  extPowerVoltage?: string;
  usb?: string;
  charging?: string;
  extPower?: string;
  lowBattery?: string | boolean;
}

export interface CellularInfo {
  operator: string;
  networkType: string;
  rssi: number;
  signalQuality: number;
  ip: string;
  imsi?: string;
  mcc?: string;
  mnc?: string;
  cellId?: string;
  tac?: string;
  band?: string;
  rsrp?: number;
  rsrq?: number;
  sinr?: number;
  signal?: string;
  ip4?: string;
  ip6?: string;
}

export interface GpsInfo {
  isFixed: boolean;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  satellites: number;
  hdop: number;
  accuracy: number;
  lastFix: string;
  lastLocation: string;
  fixType?: string;
  status?: string;
}

export interface LockInfo {
  lockStatus: boolean;
  doorStatus: boolean;
  motorStatus: string;
  motorCurrent: number;
  positionSensor: boolean;
  lastLockTime: string;
  lastUnlockTime: string;
  unlockMethod: string;
  unlockCount: number;
  failedUnlockCount: number;
  lockMotorStatus?: string;
  motorCurrentMa?: number;
  lockPositionSensor?: string;
  lastUnlockMethod?: string;
  lockStatusStr?: string;
  doorStatusStr?: string;
}

export interface AccessMethod {
  enabled: boolean;
  lastUsed: string;
  count: number;
  status?: string;
  failedAttempts?: number;
  lastAccess?: string;
}

export interface AccessInfo {
  keypad: AccessMethod;
  nfc: AccessMethod;
  bluetooth: AccessMethod;
  remote: AccessMethod;
  tamper?: TamperInfo;
  accelerometer?: AccelerometerInfo;
  rtc?: string;
}

export interface TamperInfo {
  tamperStatus: boolean;
  caseOpen: boolean;
  wireCut: boolean;
  lockBreak: boolean;
  abnormalVibration: boolean;
  forcedUnlock: boolean;
  tamperCount: number;
  lastTamperTime: string;
}

export interface AccelerometerInfo {
  motion: boolean;
  x: number;
  y: number;
  z: number;
  harshBraking: boolean;
  harshAcceleration: boolean;
  sharpTurn: boolean;
  impactCount: number;
  drivingScore: number;
  status?: string;
  harshBrakingCount?: number;
  harshAccelerationCount?: number;
  sharpTurnCount?: number;
}

export interface TripInfo {
  vehicleStatus: string;
  tripStatus: boolean;
  tripId: string;
  distance: number;
  maximumSpeed: number;
  overspeedCount: number;
}

export interface GeofenceInfo {
  status: string;
  geofenceId: string;
  violation: boolean;
  lastEvent: string;
}

export interface SensorInfo {
  temperature: number;
  internalTemperature: number;
  humidity: number;
  hardwareSensorStatus: boolean;
}

export interface SecurityInfo {
  deviceBinding: boolean;
  vehicleId: string;
  customerId: string;
  certificateStatus: boolean;
  secureBoot: boolean;
  firmwareSignature: boolean;
}

export interface MemoryInfo {
  totalStorage: number;
  usedStorage: number;
  freeStorage: number;
}

export interface DiagnosticsInfo {
  lastDiagnosticTime: string;
  errorCodes: string[];
  systemHealth: string;
}

export interface RtcInfo {
  rtcTime: string;
  rtcSynced: boolean;
}

export interface SmartLockDevice {
  deviceId: string;
  deviceName: string;
  status: DeviceStatus;
  lastSeen: string;
  device: DeviceInfo;
  power: PowerInfo;
  cellular: CellularInfo;
  gps: GpsInfo;
  lock: LockInfo;
  access: AccessInfo;
  tamper: TamperInfo;
  accelerometer: AccelerometerInfo;
  trip: TripInfo;
  geofence: GeofenceInfo;
  sensors: SensorInfo;
  security: SecurityInfo;
  memory: MemoryInfo;
  diagnostics: DiagnosticsInfo;
  rtc: RtcInfo;
  relays?: {
    '1'?: 'on' | 'off';
    '2'?: 'on' | 'off';
  };
  leds?: {
    red?: 'auto' | 'on' | 'off' | 'blink';
    green?: 'auto' | 'on' | 'off' | 'blink';
    blue?: 'auto' | 'on' | 'off' | 'blink';
  };
}

export type DeviceStatus = 'online' | 'offline' | 'warning';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface Alert {
  id: string;
  deviceId: string;
  type: string;
  message: string;
  severity: AlertSeverity;
  timestamp: string;
  acknowledged: boolean;
}

export interface LocationHistoryEntry {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  heading: number;
  accuracy: number;
  timestamp: string;
  isFixed: boolean;
}

export interface ActivityEvent {
  id: string;
  deviceId: string;
  type: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean>;
}
