import { initializeApp } from 'firebase/app'
import { getDatabase, ref, onValue, push, set, get, query, orderByChild, startAt, endAt } from 'firebase/database'
import { config } from './config'

// Initialize Firebase (only if config is provided)
let app: ReturnType<typeof initializeApp> | null = null
let database: ReturnType<typeof getDatabase> | null = null

try {
  if (config.firebase.apiKey && config.firebase.databaseURL) {
    app = initializeApp(config.firebase)
    database = getDatabase(app)
  }
} catch (e) {
  console.warn('Firebase initialization skipped:', e)
}

export { database, ref, onValue, push, set, get, query, orderByChild, startAt, endAt }
export const isFirebaseConfigured = () => !!database
