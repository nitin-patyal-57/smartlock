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
  // Walnut Medical API config
  walnut: {
    get apiKey() {
      return (typeof window !== 'undefined' && localStorage.getItem('walnut_api_key')) || import.meta.env.VITE_WALNUT_API_KEY || '092a914eaed699c47dcf5794348bb14a'
    },
    get imei() {
      return (typeof window !== 'undefined' && localStorage.getItem('walnut_imei')) || import.meta.env.VITE_WALNUT_IMEI || '861185084122719,867509082945058'
    },
    apiUrl: import.meta.env.VITE_WALNUT_API_URL || 'https://dev.walnutmedical.ai/api/soundbox/smart_logs',
  },
}