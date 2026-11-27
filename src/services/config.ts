export const config = {
  // Firebase config
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  },
  API_KEY: import.meta.env.VITE_API_KEY || 'smartlock-dev-key-2024',
  USE_MOCK_DATA: import.meta.env.VITE_USE_MOCK_DATA === 'true' || false,
  // Live SmartLock Server URL & WebSocket endpoint
  get serverUrl(): string {
    if (typeof window !== 'undefined') {
      const h = window.location.hostname
      if (h === 'localhost' || h === '127.0.0.1') {
        if (window.location.port === '3001') {
          return window.location.origin
        }
        return 'http://localhost:3001'
      }
    }
    return import.meta.env.VITE_SERVER_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001')
  },
  get wsUrl(): string {
    if (typeof window !== 'undefined') {
      const h = window.location.hostname
      if (h === 'localhost' || h === '127.0.0.1') {
        return 'ws://localhost:3001/ws'
      }
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${proto}//${window.location.host}/ws`
    }
    return import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws'
  },
  // Walnut Medical API config
  walnut: {
    get apiKey() {
      return (typeof window !== 'undefined' && localStorage.getItem('walnut_api_key')) || import.meta.env.VITE_WALNUT_API_KEY || ''
    },
    get imei() {
      return (typeof window !== 'undefined' && localStorage.getItem('walnut_imei')) || import.meta.env.VITE_WALNUT_IMEI || '861185084122685'
    },
    apiUrl: import.meta.env.VITE_WALNUT_API_URL || 'https://dev.walnutmedical.ai/api/soundbox/smart_logs',
  },
}