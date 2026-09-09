import { Challenge, GameSession, GamePlayer, ScoreEntry, AppSettings } from '../types'

import {
  apiSyncSessions,
  apiSyncPlayers,
  apiSyncChallenges,
  apiSaveChallenge,
  apiSyncScores,
  apiGetSessions,
  apiGetPlayers,
  apiGetChallenges,
  apiGetScores,
  apiSaveSettings,
  apiGetSettings,
  apiResetAll
} from './api'

const KEYS = {
  CHALLENGES: 'crackvault_challenges',
  SESSIONS: 'crackvault_sessions',
  PLAYERS: 'crackvault_players',
  SCORES: 'crackvault_scores',
  SETTINGS: 'crackvault_settings',
  CLEAN_V6: 'crackvault_clean_v6'
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

// Score Calculation: Based on speed of completion (fastest completion earns highest score and #1 rank)
export function calculateScore(
  timeTaken: number = 0,
  totalSeconds: number = 300,
  attempts: number = 1,
  _hintsRevealed?: number[] | number
): number {
  const baseScore = 5000
  const validTotal = Math.max(totalSeconds || 300, 1)
  const remainingSec = Math.max(0, validTotal - timeTaken)
  // Speed bonus: up to 5,000 points strictly proportional to remaining clock time
  const speedBonus = Math.round((remainingSec / validTotal) * 5000)
  // Accuracy deduction: 50 points per failed attempt
  const attemptPenalty = Math.max(0, attempts - 1) * 50

  return Math.max(100, baseScore + speedBonus - attemptPenalty)
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

// One-time cleanup for fresh clean state (clears old lingering zombie sessions)
function ensureCleanState() {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(KEYS.CLEAN_V6) !== 'true') {
    localStorage.removeItem(KEYS.SESSIONS)
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify([]))
    localStorage.setItem(KEYS.CLEAN_V6, 'true')
  }
}
ensureCleanState()

// Deduplicate and merge player records so each contestant name appears only once per room
export function deduplicatePlayers(players: GamePlayer[]): GamePlayer[] {
  const map = new Map<string, GamePlayer>()
  players.forEach((p) => {
    if (!p || !p.name) return
    const roomKey = (p.joinCode || p.sessionId || 'global').trim().toUpperCase()
    const nameKey = p.name.trim().toLowerCase()
    const key = `${roomKey}_${nameKey}`
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...p, name: p.name.trim() })
    } else {
      const isBetter =
        (p.status === 'solved' && existing.status !== 'solved') ||
        (p.score || 0) > (existing.score || 0) ||
        p.attempts > existing.attempts ||
        p.hintsUsed > existing.hintsUsed ||
        (existing.status === 'waiting' && p.status === 'playing')

      const mergedStatus =
        existing.status === 'solved' || p.status === 'solved'
          ? 'solved'
          : existing.status === 'playing' || p.status === 'playing'
          ? 'playing'
          : existing.status === 'failed' || p.status === 'failed'
          ? 'failed'
          : 'waiting'

      map.set(key, {
        ...(isBetter ? p : existing),
        name: p.name.trim(),
        joinCode: (p.joinCode || existing.joinCode || '').toUpperCase(),
        sessionId: p.sessionId || existing.sessionId,
        attempts: Math.max(existing.attempts || 0, p.attempts || 0),
        hintsUsed: Math.max(existing.hintsUsed || 0, p.hintsUsed || 0),
        score: Math.max(existing.score || 0, p.score || 0) || undefined,
        solveTime: p.solveTime !== undefined ? p.solveTime : existing.solveTime,
        status: mergedStatus,
        revealedHints: Array.from(new Set([...(existing.revealedHints || []), ...(p.revealedHints || [])]))
      })
    }
  })
  return Array.from(map.values())
}

// UI helper to guarantee strict deduplication by contestant name within any single session view
export function deduplicatePlayersByName(players: GamePlayer[]): GamePlayer[] {
  const map = new Map<string, GamePlayer>()
  players.forEach((p) => {
    if (!p || !p.name) return
    const key = p.name.trim().toLowerCase()
    const existing = map.get(key)
    if (!existing) {
      map.set(key, { ...p, name: p.name.trim() })
    } else {
      const isBetter =
        (p.status === 'solved' && existing.status !== 'solved') ||
        (p.score || 0) > (existing.score || 0) ||
        p.attempts > existing.attempts ||
        p.hintsUsed > existing.hintsUsed ||
        (existing.status === 'waiting' && p.status === 'playing')

      const mergedStatus =
        existing.status === 'solved' || p.status === 'solved'
          ? 'solved'
          : existing.status === 'playing' || p.status === 'playing'
          ? 'playing'
          : existing.status === 'failed' || p.status === 'failed'
          ? 'failed'
          : 'waiting'

      map.set(key, {
        ...(isBetter ? p : existing),
        name: p.name.trim(),
        attempts: Math.max(existing.attempts || 0, p.attempts || 0),
        hintsUsed: Math.max(existing.hintsUsed || 0, p.hintsUsed || 0),
        score: Math.max(existing.score || 0, p.score || 0) || undefined,
        solveTime: p.solveTime !== undefined ? p.solveTime : existing.solveTime,
        status: mergedStatus,
        revealedHints: Array.from(new Set([...(existing.revealedHints || []), ...(p.revealedHints || [])]))
      })
    }
  })
  return Array.from(map.values())
}

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
    try {
      localStorage.setItem(KEYS.CHALLENGES, JSON.stringify(challenges))
    } catch (e) {
      console.warn('⚠️ [Storage] LocalStorage quota exceeded, storing lightweight challenges locally:', e)
      try {
        const lightweight = challenges.map((c) => ({
          ...c,
          imageUrl: c.imageUrl && c.imageUrl.length > 500 ? '' : c.imageUrl,
          hints: c.hints.map((h) => (h && h.length > 500 ? '[Image Attached]' : h)) as [string, string, string, string, string],
          hintItems: (c.hintItems || []).map((item) => ({
            ...item,
            content: item.content && item.content.length > 500 ? '[Image Attached]' : item.content
          }))
        }))
        localStorage.setItem(KEYS.CHALLENGES, JSON.stringify(lightweight))
      } catch {}
    }
    broadcastStateChange('CHALLENGES_UPDATED')
    apiSyncChallenges(challenges).catch(() => {})
  },

  getSessions(): GameSession[] {
    ensureCleanState()
    const raw = localStorage.getItem(KEYS.SESSIONS)
    if (!raw) {
      return []
    }
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((s) => s && s.id && s.joinCode) : []
    } catch {
      return []
    }
  },

  saveSessions(sessions: GameSession[]) {
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions))
    broadcastStateChange('SESSIONS_UPDATED')
    apiSyncSessions(sessions).catch(() => {})
  },

  getPlayers(): GamePlayer[] {
    ensureCleanState()
    const raw = localStorage.getItem(KEYS.PLAYERS)
    if (!raw) {
      return []
    }
    try {
      const parsed: GamePlayer[] = JSON.parse(raw)
      const cleaned = deduplicatePlayers(parsed)
      // Auto-heal: If duplicates existed in localStorage, immediately write back the clean array
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(KEYS.PLAYERS, JSON.stringify(cleaned))
      }
      return cleaned
    } catch {
      return []
    }
  },

  savePlayers(players: GamePlayer[]) {
    const clean = deduplicatePlayers(players)
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify(clean))
    broadcastStateChange('PLAYERS_UPDATED')
    apiSyncPlayers(clean).catch(() => {})
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
    apiSyncScores(scores).catch(() => {})
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
    apiSaveSettings(settings).catch(() => {})
  },

  resetAll() {
    localStorage.setItem(KEYS.CHALLENGES, JSON.stringify([]))
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS))
    localStorage.setItem(KEYS.SCORES, JSON.stringify([]))
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify([]))
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify([]))
    localStorage.setItem(KEYS.CLEAN_V6, 'true')
    broadcastStateChange('ALL_RESET')
    apiResetAll().catch(() => {})
  }
}

let isMongoOnline = true

export function isCloudActive(): boolean {
  return isMongoOnline
}

export function setMongoOnline(online: boolean) {
  isMongoOnline = online
}

// --- CLOUD SYNC INITIALIZATION & LISTENER SUBSCRIPTION ---

let unsubscribers: Array<(() => void) | null> = []

export function initCloudSync(onSyncEvent?: (type: string) => void): () => void {
  // Teardown any previous listeners
  unsubscribers.forEach((unsub) => unsub && unsub())
  unsubscribers = []



  // --- 2. EXPRESS + MONGODB ATLAS REALTIME SYNC (PRIMARY) ---
  let isSyncing = false
  const syncWithMongoBackend = async () => {
    if (isSyncing) return
    isSyncing = true
    try {
      const [remoteSessions, remotePlayers, remoteChallenges, remoteScores] = await Promise.all([
        apiGetSessions(),
        apiGetPlayers(),
        apiGetChallenges(),
        apiGetScores()
      ])

      isMongoOnline = remoteSessions !== null || remotePlayers !== null

      if (remoteSessions && Array.isArray(remoteSessions)) {
        const local = storage.getSessions()
        // NEVER auto-create or auto-push sessions to MongoDB. If remote is empty, local becomes empty.
        if (JSON.stringify(remoteSessions) !== JSON.stringify(local)) {
          try {
            localStorage.setItem(KEYS.SESSIONS, JSON.stringify(remoteSessions))
          } catch {}
          broadcastStateChange('SESSIONS_UPDATED')
          onSyncEvent?.('SESSIONS_UPDATED')
        }
      }

      if (remotePlayers && Array.isArray(remotePlayers)) {
        const local = storage.getPlayers()
        if (remotePlayers.length === 0 && local.length > 0) {
          apiSyncPlayers(local).catch(() => {})
        } else {
          const deduped = deduplicatePlayers(remotePlayers)
          if (JSON.stringify(deduped) !== JSON.stringify(local)) {
            localStorage.setItem(KEYS.PLAYERS, JSON.stringify(deduped))
            broadcastStateChange('PLAYERS_UPDATED')
            onSyncEvent?.('PLAYERS_UPDATED')
          }
        }
      }

      if (remoteChallenges && Array.isArray(remoteChallenges)) {
        const local = storage.getChallenges()
        if (remoteChallenges.length === 0 && local.length > 0) {
          apiSyncChallenges(local).catch(() => {})
        } else {
          // Merge local and remote by id so in-flight local additions are preserved
          const map = new Map<string, Challenge>()
          remoteChallenges.forEach((c) => map.set(c.id, c))
          local.forEach((c) => {
            if (!map.has(c.id)) {
              map.set(c.id, c)
              apiSaveChallenge(c).catch(() => {})
            }
          })
          const merged = Array.from(map.values())
          if (JSON.stringify(merged) !== JSON.stringify(local)) {
            try {
              localStorage.setItem(KEYS.CHALLENGES, JSON.stringify(merged))
            } catch {}
            broadcastStateChange('CHALLENGES_UPDATED')
            onSyncEvent?.('CHALLENGES_UPDATED')
          }
        }
      }

      if (remoteScores && Array.isArray(remoteScores)) {
        const local = storage.getScores()
        if (remoteScores.length === 0 && local.length > 0) {
          apiSyncScores(local).catch(() => {})
        } else {
          const sorted = [...remoteScores].sort((a, b) => (b.score || 0) - (a.score || 0))
          if (JSON.stringify(sorted) !== JSON.stringify(local)) {
            localStorage.setItem(KEYS.SCORES, JSON.stringify(sorted))
            broadcastStateChange('SCORES_UPDATED')
            onSyncEvent?.('SCORES_UPDATED')
          }
        }
      }
    } catch {
      isMongoOnline = false
    } finally {
      isSyncing = false
    }
  }

  // Initial sync immediately
  syncWithMongoBackend()

  // Real-time polling every 1.5 seconds for cross-device synchronization
  const pollInterval = setInterval(syncWithMongoBackend, 1500)
  unsubscribers.push(() => clearInterval(pollInterval))

  return () => {
    unsubscribers.forEach((unsub) => unsub && unsub())
    unsubscribers = []
  }
}
