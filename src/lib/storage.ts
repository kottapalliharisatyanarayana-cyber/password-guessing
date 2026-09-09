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
  CLEAN_V7: 'crackvault_clean_v7'
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

// One-time cleanup for fresh clean state (clears old lingering data and establishes 0-data baseline)
function ensureCleanState() {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(KEYS.CLEAN_V7) !== 'true') {
    localStorage.removeItem(KEYS.CHALLENGES)
    localStorage.setItem(KEYS.CHALLENGES, JSON.stringify([]))
    localStorage.removeItem(KEYS.SESSIONS)
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify([]))
    localStorage.removeItem(KEYS.PLAYERS)
    localStorage.setItem(KEYS.PLAYERS, JSON.stringify([]))
    localStorage.removeItem(KEYS.SCORES)
    localStorage.setItem(KEYS.SCORES, JSON.stringify([]))
    localStorage.setItem(KEYS.CLEAN_V7, 'true')
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
    localStorage.setItem(KEYS.CLEAN_V7, 'true')
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

// Helper to quickly compare session lists without serializing entire objects
function sessionsSignature(list: GameSession[]): string {
  return list
    .map(
      (s) =>
        `${s.id}:${s.status}:${s.startedAt || 0}:${s.forceUnlockedHints?.length || 0}:${s.winnerName || ''}:${s.totalSeconds || 0}:${s.remainingSeconds || 0}`
    )
    .sort()
    .join('|')
}

// Intelligent non-destructive reconciliation of local and remote sessions
export function reconcileSessions(
  local: GameSession[],
  remote: GameSession[]
): { merged: GameSession[]; needsPushToRemote: boolean } {
  const map = new Map<string, GameSession>()
  let needsPushToRemote = false

  // 1. Index remote sessions
  remote.forEach((r) => {
    if (r && r.id) {
      map.set(r.id, r)
    }
  })

  // 2. Reconcile with local sessions
  local.forEach((l) => {
    if (!l || !l.id) return
    const r = map.get(l.id)
    if (!r) {
      // Local has a session that remote doesn't have yet (e.g. newly launched in UI)
      // KEEP IT! Never delete active sessions from local if remote is empty or lagging
      map.set(l.id, l)
      needsPushToRemote = true
    } else {
      // Both have the session: resolve conflicting states intelligently
      const statusWeight = (status?: string) => {
        if (status === 'ended') return 4
        if (status === 'playing') return 3
        if (status === 'paused') return 2
        return 1
      }
      const lWeight = statusWeight(l.status)
      const rWeight = statusWeight(r.status)

      if (lWeight > rWeight) {
        // Local is ahead (e.g. started playing while remote poll was in flight)
        map.set(l.id, { ...r, ...l })
        needsPushToRemote = true
      } else if (rWeight > lWeight) {
        // Remote is ahead (e.g. ended by host)
        map.set(l.id, { ...l, ...r })
      } else {
        // Equal status: pick whichever has more hints/winner or keep local challenge attached
        const lHints = l.forceUnlockedHints?.length || 0
        const rHints = r.forceUnlockedHints?.length || 0
        map.set(l.id, {
          ...r,
          ...l,
          challenge: l.challenge || r.challenge,
          forceUnlockedHints: lHints >= rHints ? l.forceUnlockedHints : r.forceUnlockedHints,
          winnerName: r.winnerName || l.winnerName,
          winnerScore: r.winnerScore !== undefined ? r.winnerScore : l.winnerScore
        })
      }
    }
  })

  return { merged: Array.from(map.values()), needsPushToRemote }
}

// --- CLOUD SYNC INITIALIZATION & LISTENER SUBSCRIPTION ---

let unsubscribers: Array<(() => void) | null> = []

export function initCloudSync(onSyncEvent?: (type: string) => void): () => void {
  // Teardown any previous listeners
  unsubscribers.forEach((unsub) => unsub && unsub())
  unsubscribers = []

  let isSyncing = false
  let cycleCount = 0

  const syncWithMongoBackend = async (forceAll: boolean = false) => {
    // If tab is in background and not forcing, skip cycles to conserve CPU & network
    if (typeof document !== 'undefined' && document.hidden && !forceAll && cycleCount % 4 !== 0) {
      cycleCount++
      return
    }

    if (isSyncing) return
    isSyncing = true
    cycleCount++

    try {
      const syncChallengesAndScores = forceAll || cycleCount % 3 === 0

      // Run live session + player sync every 3s; run heavy challenges + scores every 9s
      const [remoteSessions, remotePlayers, remoteChallenges, remoteScores] = await Promise.all([
        apiGetSessions(),
        apiGetPlayers(),
        syncChallengesAndScores ? apiGetChallenges() : Promise.resolve(null),
        syncChallengesAndScores ? apiGetScores() : Promise.resolve(null)
      ])

      isMongoOnline = remoteSessions !== null || remotePlayers !== null

      // Reconcile Sessions (never wipe local active sessions!)
      if (remoteSessions && Array.isArray(remoteSessions)) {
        const local = storage.getSessions()
        const { merged, needsPushToRemote } = reconcileSessions(local, remoteSessions)

        const localSig = sessionsSignature(local)
        const mergedSig = sessionsSignature(merged)

        if (localSig !== mergedSig) {
          try {
            localStorage.setItem(KEYS.SESSIONS, JSON.stringify(merged))
          } catch {}
          broadcastStateChange('SESSIONS_UPDATED')
          onSyncEvent?.('SESSIONS_UPDATED')
        }

        // If local had sessions unknown to MongoDB Atlas, push them up
        if (needsPushToRemote && merged.length > 0) {
          apiSyncSessions(merged).catch(() => {})
        }
      }

      // Reconcile Players
      if (remotePlayers && Array.isArray(remotePlayers)) {
        const local = storage.getPlayers()
        const combined = deduplicatePlayers([...remotePlayers, ...local])
        if (combined.length !== local.length || JSON.stringify(combined) !== JSON.stringify(local)) {
          localStorage.setItem(KEYS.PLAYERS, JSON.stringify(combined))
          broadcastStateChange('PLAYERS_UPDATED')
          onSyncEvent?.('PLAYERS_UPDATED')
        }
      }

      // Reconcile Challenges
      if (remoteChallenges && Array.isArray(remoteChallenges)) {
        const local = storage.getChallenges()
        if (remoteChallenges.length !== local.length || remoteChallenges.some((c, i) => !local[i] || c.id !== local[i].id)) {
          try {
            localStorage.setItem(KEYS.CHALLENGES, JSON.stringify(remoteChallenges))
          } catch {}
          broadcastStateChange('CHALLENGES_UPDATED')
          onSyncEvent?.('CHALLENGES_UPDATED')
        }
      }

      // Reconcile Scores
      if (remoteScores && Array.isArray(remoteScores)) {
        const local = storage.getScores()
        const sorted = [...remoteScores].sort((a, b) => (b.score || 0) - (a.score || 0))
        if (sorted.length !== local.length || (sorted[0]?.id !== local[0]?.id)) {
          localStorage.setItem(KEYS.SCORES, JSON.stringify(sorted))
          broadcastStateChange('SCORES_UPDATED')
          onSyncEvent?.('SCORES_UPDATED')
        }
      }
    } catch {
      isMongoOnline = false
    } finally {
      isSyncing = false
    }
  }

  // Initial sync immediately
  syncWithMongoBackend(true)

  // Real-time polling every 3.0s (instead of 1.5s) to eliminate CPU lag and API storming
  const pollInterval = setInterval(() => syncWithMongoBackend(false), 3000)
  unsubscribers.push(() => clearInterval(pollInterval))

  // Instant sync when tab becomes visible again
  if (typeof document !== 'undefined') {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncWithMongoBackend(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    unsubscribers.push(() => document.removeEventListener('visibilitychange', handleVisibilityChange))
  }

  return () => {
    unsubscribers.forEach((unsub) => unsub && unsub())
    unsubscribers = []
  }
}
