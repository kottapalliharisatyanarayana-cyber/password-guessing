import { Challenge, GameSession, GamePlayer, ScoreEntry, AppSettings } from '../types'
import {
  cloudSaveSessions,
  cloudSavePlayers,
  cloudSaveChallenges,
  cloudSaveScores,
  cloudSaveSettings,
  subscribeCloudSessions,
  subscribeCloudPlayers,
  subscribeCloudChallenges,
  subscribeCloudScores,
  isFirebaseConnected,
  initFirebase
} from './firebase'

const KEYS = {
  CHALLENGES: 'crackvault_challenges',
  SESSIONS: 'crackvault_sessions',
  PLAYERS: 'crackvault_players',
  SCORES: 'crackvault_scores',
  SETTINGS: 'crackvault_settings',
  CLEAN_V4: 'crackvault_clean_v4'
}

// Default Seed Challenges: Clean slate (0 challenges)
export const SEED_CHALLENGES: Challenge[] = []

export const DEFAULT_SETTINGS: AppSettings = {
  adminUsername: 'admin',
  adminPassword: 'admin123',
  defaultTimeLimit: 300,
  soundEnabled: true
}

// Hint costs: Set to 0 because hints reveal strictly over the countdown timer with zero point deduction
export const HINT_POINT_COSTS = [0, 0, 0, 0, 0, 0]

// Score Calculation: Flat score based on successful crack & guess accuracy
export function calculateScore(
  _timeTaken?: number,
  attempts: number = 1,
  _hintsRevealed?: number[] | number
): number {
  const base = 10000
  const attemptPenalty = Math.max(0, attempts - 1) * 50
  return Math.max(0, base - attemptPenalty)
}

// Calculate total hint penalty points (always 0)
export function calculateHintPenalty(_hintsRevealed?: number[] | number): number {
  return 0
}

// Real-time broadcast channel for intra-browser multi-tab sync
const channel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('crackvault_channel')
    : null

export function broadcastStateChange(action: string, payload?: unknown) {
  if (channel) {
    channel.postMessage({ action, payload, timestamp: Date.now() })
  }
}

export function subscribeStateChange(callback: (action: string, payload: unknown) => void) {
  if (!channel) return () => {}
  const listener = (event: MessageEvent) => {
    if (event.data && event.data.action) {
      callback(event.data.action, event.data.payload)
    }
  }
  channel.addEventListener('message', listener)
  return () => channel.removeEventListener('message', listener)
}

// One-time cleanup for fresh clean state
function ensureCleanState() {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(KEYS.CLEAN_V4) !== 'true') {
    localStorage.removeItem(KEYS.CHALLENGES)
    localStorage.removeItem(KEYS.SESSIONS)
    localStorage.removeItem(KEYS.PLAYERS)
    localStorage.removeItem(KEYS.SCORES)
    localStorage.setItem(KEYS.CHALLENGES, JSON.stringify([]))
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify([]))
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify([]))
    localStorage.setItem(KEYS.SCORES, JSON.stringify([]))
    localStorage.setItem(KEYS.CLEAN_V4, 'true')
  }
}
ensureCleanState()

// Flag to prevent cloud-to-local updates from bouncing back to cloud
let isIncomingCloudUpdate = false

// Storage API Helpers
export const storage = {
  getChallenges(): Challenge[] {
    ensureCleanState()
    const raw = localStorage.getItem(KEYS.CHALLENGES)
    if (!raw) {
      localStorage.setItem(KEYS.CHALLENGES, JSON.stringify([]))
      return []
    }
    try {
      return JSON.parse(raw)
    } catch {
      return []
    }
  },

  saveChallenges(challenges: Challenge[]) {
    localStorage.setItem(KEYS.CHALLENGES, JSON.stringify(challenges))
    broadcastStateChange('CHALLENGES_UPDATED')
    if (!isIncomingCloudUpdate) {
      cloudSaveChallenges(challenges)
    }
  },

  getSessions(): GameSession[] {
    ensureCleanState()
    const raw = localStorage.getItem(KEYS.SESSIONS)
    if (!raw) {
      return []
    }
    try {
      return JSON.parse(raw)
    } catch {
      return []
    }
  },

  saveSessions(sessions: GameSession[]) {
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions))
    broadcastStateChange('SESSIONS_UPDATED')
    if (!isIncomingCloudUpdate) {
      cloudSaveSessions(sessions)
    }
  },

  getPlayers(): GamePlayer[] {
    ensureCleanState()
    const raw = localStorage.getItem(KEYS.PLAYERS)
    if (!raw) {
      return []
    }
    try {
      return JSON.parse(raw)
    } catch {
      return []
    }
  },

  savePlayers(players: GamePlayer[]) {
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(players))
    broadcastStateChange('PLAYERS_UPDATED')
    if (!isIncomingCloudUpdate) {
      cloudSavePlayers(players)
    }
  },

  getScores(): ScoreEntry[] {
    ensureCleanState()
    const raw = localStorage.getItem(KEYS.SCORES)
    if (!raw) {
      return []
    }
    try {
      return JSON.parse(raw)
    } catch {
      return []
    }
  },

  saveScores(scores: ScoreEntry[]) {
    localStorage.setItem(KEYS.SCORES, JSON.stringify(scores))
    broadcastStateChange('SCORES_UPDATED')
    if (!isIncomingCloudUpdate) {
      cloudSaveScores(scores)
    }
  },

  addScore(entry: Omit<ScoreEntry, 'id' | 'createdAt'>): ScoreEntry {
    const scores = this.getScores()
    const newEntry: ScoreEntry = {
      ...entry,
      id: 'score_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString()
    }
    scores.unshift(newEntry)
    this.saveScores(scores)
    return newEntry
  },

  getSettings(): AppSettings {
    const raw = localStorage.getItem(KEYS.SETTINGS)
    if (!raw) {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS))
      return DEFAULT_SETTINGS
    }
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    } catch {
      return DEFAULT_SETTINGS
    }
  },

  saveSettings(settings: AppSettings) {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings))
    broadcastStateChange('SETTINGS_UPDATED')
    if (!isIncomingCloudUpdate) {
      cloudSaveSettings(settings)
    }
  },

  resetAll() {
    localStorage.setItem(KEYS.CHALLENGES, JSON.stringify([]))
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS))
    localStorage.setItem(KEYS.SCORES, JSON.stringify([]))
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify([]))
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify([]))
    localStorage.setItem(KEYS.CLEAN_V4, 'true')
    broadcastStateChange('ALL_RESET')
    if (!isIncomingCloudUpdate) {
      cloudSaveChallenges([])
      cloudSaveSessions([])
      cloudSavePlayers([])
      cloudSaveScores([])
      cloudSaveSettings(DEFAULT_SETTINGS)
    }
  }
}

// --- CLOUD SYNC INITIALIZATION & LISTENER SUBSCRIPTION ---

let unsubscribers: Array<(() => void) | null> = []

export function initCloudSync(onSyncEvent?: (type: string) => void): () => void {
  // Teardown any previous listeners
  unsubscribers.forEach((unsub) => unsub && unsub())
  unsubscribers = []

  const db = initFirebase()
  if (!db) return () => {}

  // 1. Sessions Listener
  const unsubSessions = subscribeCloudSessions((remoteSessions) => {
    isIncomingCloudUpdate = true
    try {
      localStorage.setItem(KEYS.SESSIONS, JSON.stringify(remoteSessions))
      broadcastStateChange('SESSIONS_UPDATED')
      onSyncEvent?.('SESSIONS_UPDATED')
    } finally {
      isIncomingCloudUpdate = false
    }
  })

  // 2. Players Listener
  const unsubPlayers = subscribeCloudPlayers((remotePlayers) => {
    isIncomingCloudUpdate = true
    try {
      localStorage.setItem(KEYS.PLAYERS, JSON.stringify(remotePlayers))
      broadcastStateChange('PLAYERS_UPDATED')
      onSyncEvent?.('PLAYERS_UPDATED')
    } finally {
      isIncomingCloudUpdate = false
    }
  })

  // 3. Challenges Listener
  const unsubChallenges = subscribeCloudChallenges((remoteChallenges) => {
    // Only update if remote has challenges or local is empty
    if (remoteChallenges.length > 0 || storage.getChallenges().length === 0) {
      isIncomingCloudUpdate = true
      try {
        localStorage.setItem(KEYS.CHALLENGES, JSON.stringify(remoteChallenges))
        broadcastStateChange('CHALLENGES_UPDATED')
        onSyncEvent?.('CHALLENGES_UPDATED')
      } finally {
        isIncomingCloudUpdate = false
      }
    }
  })

  // 4. Scores Listener
  const unsubScores = subscribeCloudScores((remoteScores) => {
    isIncomingCloudUpdate = true
    try {
      localStorage.setItem(KEYS.SCORES, JSON.stringify(remoteScores))
      broadcastStateChange('SCORES_UPDATED')
      onSyncEvent?.('SCORES_UPDATED')
    } finally {
      isIncomingCloudUpdate = false
    }
  })

  unsubscribers = [unsubSessions, unsubPlayers, unsubChallenges, unsubScores]

  return () => {
    unsubscribers.forEach((unsub) => unsub && unsub())
    unsubscribers = []
  }
}
