import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app'
import { getDatabase, Database, ref, set, onValue, Unsubscribe } from 'firebase/database'
import { Challenge, GameSession, GamePlayer, ScoreEntry, AppSettings } from '../types'

export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  databaseURL: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId?: string
}

const STORAGE_KEY_FIREBASE = 'crackvault_firebase_config'

// Retrieve config from Vite environment variables or localStorage
export function getFirebaseConfig(): FirebaseConfig | null {
  // Check environment variables first (bundled at build time)
  const envConfig: FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
  }

  if (envConfig.databaseURL && envConfig.apiKey) {
    return envConfig
  }

  // Fallback to in-app localStorage config (allows admin to set credentials directly in the UI)
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_FIREBASE)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.databaseURL && parsed.apiKey) {
          return parsed
        }
      } catch {
        // ignore parse error
      }
    }
  }

  return null
}

export function saveFirebaseConfig(config: FirebaseConfig) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_FIREBASE, JSON.stringify(config))
    // Reset app instance to reinitialize
    appInstance = null
    dbInstance = null
    initFirebase()
  }
}

export function clearFirebaseConfig() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_FIREBASE)
    appInstance = null
    dbInstance = null
  }
}

let appInstance: FirebaseApp | null = null
let dbInstance: Database | null = null

export function initFirebase(): Database | null {
  if (dbInstance) return dbInstance

  const config = getFirebaseConfig()
  if (!config || !config.databaseURL || !config.apiKey) {
    return null
  }

  try {
    if (!getApps().length) {
      appInstance = initializeApp(config)
    } else {
      appInstance = getApp()
    }
    dbInstance = getDatabase(appInstance)
    return dbInstance
  } catch (err) {
    console.warn('Firebase initialization error:', err)
    return null
  }
}

export function isFirebaseConnected(): boolean {
  return initFirebase() !== null
}

// --- CLOUD SYNC OPERATIONS ---

export async function cloudSaveSessions(sessions: GameSession[]): Promise<void> {
  const db = initFirebase()
  if (!db) return
  try {
    await set(ref(db, 'sessions'), sessions)
  } catch (err) {
    console.warn('Failed to sync sessions to cloud:', err)
  }
}

export async function cloudSavePlayers(players: GamePlayer[]): Promise<void> {
  const db = initFirebase()
  if (!db) return
  try {
    await set(ref(db, 'players'), players)
  } catch (err) {
    console.warn('Failed to sync players to cloud:', err)
  }
}

export async function cloudSaveChallenges(challenges: Challenge[]): Promise<void> {
  const db = initFirebase()
  if (!db) return
  try {
    await set(ref(db, 'challenges'), challenges)
  } catch (err) {
    console.warn('Failed to sync challenges to cloud:', err)
  }
}

export async function cloudSaveScores(scores: ScoreEntry[]): Promise<void> {
  const db = initFirebase()
  if (!db) return
  try {
    await set(ref(db, 'scores'), scores)
  } catch (err) {
    console.warn('Failed to sync scores to cloud:', err)
  }
}

export async function cloudSaveSettings(settings: AppSettings): Promise<void> {
  const db = initFirebase()
  if (!db) return
  try {
    await set(ref(db, 'settings'), settings)
  } catch (err) {
    console.warn('Failed to sync settings to cloud:', err)
  }
}

// --- CLOUD LISTENERS ---

export function subscribeCloudSessions(callback: (sessions: GameSession[]) => void): Unsubscribe | null {
  const db = initFirebase()
  if (!db) return null

  const sessionsRef = ref(db, 'sessions')
  return onValue(sessionsRef, (snapshot) => {
    const val = snapshot.val()
    if (val && Array.isArray(val)) {
      callback(val)
    } else if (val && typeof val === 'object') {
      callback(Object.values(val))
    } else {
      callback([])
    }
  })
}

export function subscribeCloudPlayers(callback: (players: GamePlayer[]) => void): Unsubscribe | null {
  const db = initFirebase()
  if (!db) return null

  const playersRef = ref(db, 'players')
  return onValue(playersRef, (snapshot) => {
    const val = snapshot.val()
    if (val && Array.isArray(val)) {
      callback(val)
    } else if (val && typeof val === 'object') {
      callback(Object.values(val))
    } else {
      callback([])
    }
  })
}

export function subscribeCloudChallenges(callback: (challenges: Challenge[]) => void): Unsubscribe | null {
  const db = initFirebase()
  if (!db) return null

  const challengesRef = ref(db, 'challenges')
  return onValue(challengesRef, (snapshot) => {
    const val = snapshot.val()
    if (val && Array.isArray(val)) {
      callback(val)
    } else if (val && typeof val === 'object') {
      callback(Object.values(val))
    } else {
      callback([])
    }
  })
}

export function subscribeCloudScores(callback: (scores: ScoreEntry[]) => void): Unsubscribe | null {
  const db = initFirebase()
  if (!db) return null

  const scoresRef = ref(db, 'scores')
  return onValue(scoresRef, (snapshot) => {
    const val = snapshot.val()
    if (val && Array.isArray(val)) {
      callback(val)
    } else if (val && typeof val === 'object') {
      callback(Object.values(val))
    } else {
      callback([])
    }
  })
}
