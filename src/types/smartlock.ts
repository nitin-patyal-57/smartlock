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
}

export interface CellularInfo {
  operator: string;
  networkType: string;
  rssi: number;
  signalQuality: number;
  ip: string;
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
}

export interface AccessMethod {
  enabled: boolean;
  lastUsed: string;
  count: number;
}

export interface AccessInfo {
  keypad: AccessMethod;
  nfc: AccessMethod;
  bluetooth: AccessMethod;
  remote: AccessMethod;
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
