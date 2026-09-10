import { Challenge, GameSession, GamePlayer, ScoreEntry, AppSettings } from '../types'

import {
  apiSyncSessions,
  apiSyncPlayers,
  apiSyncChallenges,
  apiSaveChallenge,
  apiSyncScores,
  apiSaveScore,
  apiDeleteSession,
  apiDeleteChallenge,
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
  DELETED_SESSIONS: 'crackvault_deleted_sessions',
  DELETED_CHALLENGES: 'crackvault_deleted_challenges',
  CLEAN_V7: 'crackvault_clean_v7'
}

// Track deleted session IDs to prevent zombie resurrection across cloud sync cycles
export function markSessionDeleted(sessionId: string) {
  if (typeof localStorage === 'undefined' || !sessionId) return
  try {
    const raw = localStorage.getItem(KEYS.DELETED_SESSIONS)
    const map: Record<string, number> = raw ? JSON.parse(raw) : {}
    map[sessionId] = Date.now()
    // Retain tombstone for 7 days then prune
    const cutoff = Date.now() - 7 * 86400000
    for (const id in map) {
      if (map[id] < cutoff) delete map[id]
    }
    localStorage.setItem(KEYS.DELETED_SESSIONS, JSON.stringify(map))
    broadcastStateChange('SESSION_DELETED', sessionId)
  } catch {}
}

export function isSessionDeleted(sessionId: string): boolean {
  if (typeof localStorage === 'undefined' || !sessionId) return false
  try {
    const raw = localStorage.getItem(KEYS.DELETED_SESSIONS)
    if (!raw) return false
    const map: Record<string, number> = JSON.parse(raw)
    return Boolean(map[sessionId])
  } catch {
    return false
  }
}

// Track deleted challenge IDs to prevent automatic recreation or zombie resurrection
export function markChallengeDeleted(challengeId: string) {
  if (typeof localStorage === 'undefined' || !challengeId) return
  try {
    const raw = localStorage.getItem(KEYS.DELETED_CHALLENGES)
    const map: Record<string, number> = raw ? JSON.parse(raw) : {}
    map[challengeId] = Date.now()
    const cutoff = Date.now() - 7 * 86400000
    for (const id in map) {
      if (map[id] < cutoff) delete map[id]
    }
    localStorage.setItem(KEYS.DELETED_CHALLENGES, JSON.stringify(map))
    broadcastStateChange('CHALLENGE_DELETED', challengeId)
  } catch {}
}

export function isChallengeDeleted(challengeId: string): boolean {
  if (typeof localStorage === 'undefined' || !challengeId) return false
  try {
    const raw = localStorage.getItem(KEYS.DELETED_CHALLENGES)
    if (!raw) return false
    const map: Record<string, number> = JSON.parse(raw)
    return Boolean(map[challengeId])
  } catch {
    return false
  }
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
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed)
        ? parsed.filter((c) => c && c.id && !isChallengeDeleted(c.id))
        : []
    } catch {
      return []
    }
  },

  saveChallenges(challenges: Challenge[]) {
    const clean = challenges.filter((c) => c && c.id && !isChallengeDeleted(c.id))
    try {
      localStorage.setItem(KEYS.CHALLENGES, JSON.stringify(clean))
    } catch (e) {
      console.warn('⚠️ [Storage] LocalStorage quota exceeded, storing lightweight challenges locally:', e)
      try {
        const lightweight = clean.map((c) => ({
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
  },

  deleteChallenge(id: string) {
    markChallengeDeleted(id)
    const current = this.getChallenges().filter((c) => c.id !== id)
    this.saveChallenges(current)
    apiDeleteChallenge(id).catch(() => {})
  },

  getSessions(): GameSession[] {
    ensureCleanState()
    const raw = localStorage.getItem(KEYS.SESSIONS)
    if (!raw) {
      return []
    }
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed)
        ? parsed.filter((s) => s && s.id && s.joinCode && !isSessionDeleted(s.id))
        : []
    } catch {
      return []
    }
  },

  saveSessions(sessions: GameSession[]) {
    const clean = sessions.filter((s) => s && s.id && !isSessionDeleted(s.id))
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(clean))
    broadcastStateChange('SESSIONS_UPDATED')
  },

  deleteSession(sessionId: string) {
    markSessionDeleted(sessionId)
    const current = this.getSessions().filter((s) => s.id !== sessionId)
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(current))
    broadcastStateChange('SESSIONS_UPDATED')
    apiDeleteSession(sessionId).catch(() => {})
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
    apiSaveScore(newEntry).catch(() => {})
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

  // 1. Index remote sessions (strictly ignoring any session marked as deleted locally)
  remote.forEach((r) => {
    if (r && r.id) {
      if (isSessionDeleted(r.id)) {
        // Actively clean up remote if it was marked deleted locally
        apiDeleteSession(r.id).catch(() => {})
      } else {
        map.set(r.id, r)
      }
    }
  })

  // 2. Reconcile with local sessions (preserve local sessions, never drop unless explicitly deleted)
  local.forEach((l) => {
    if (!l || !l.id || isSessionDeleted(l.id)) return
    const r = map.get(l.id)
    if (!r) {
      // Local session not present on remote yet:
      // Keep it in active state and ensure it gets pushed to remote backend
      map.set(l.id, l)
      needsPushToRemote = true
    } else {
      // Both have the session: merge status, timers, and attributes intelligently
      const lHints = l.forceUnlockedHints?.length || 0
      const rHints = r.forceUnlockedHints?.length || 0
      const winnerName = r.winnerName || l.winnerName
      const winnerScore = r.winnerScore !== undefined ? r.winnerScore : l.winnerScore

      // Status resolution: if local was started/playing or paused, don't revert to lobby unless explicitly reset
      const statusPriority: Record<string, number> = { ended: 4, playing: 3, paused: 2, lobby: 1 }
      const rPrio = statusPriority[r.status] || 1
      const lPrio = statusPriority[l.status] || 1
      const finalStatus = rPrio >= lPrio ? r.status : l.status

      map.set(l.id, {
        ...l,
        ...r,
        status: finalStatus,
        startedAt: r.status === 'lobby' ? undefined : (r.startedAt ?? l.startedAt),
        remainingSeconds: r.remainingSeconds !== undefined ? r.remainingSeconds : (l.remainingSeconds ?? l.totalSeconds),
        totalSeconds: r.totalSeconds || l.totalSeconds || 300,
        challenge: l.challenge || r.challenge,
        forceUnlockedHints: rHints >= lHints ? (r.forceUnlockedHints || []) : (l.forceUnlockedHints || []),
        winnerName,
        winnerScore
      })
    }
  })

  const merged = Array.from(map.values()).filter((s) => !isSessionDeleted(s.id))
  return { merged, needsPushToRemote }
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

      // Reconcile Challenges non-destructively (never wipe local challenges)
      if (remoteChallenges && Array.isArray(remoteChallenges)) {
        const cleanRemote = remoteChallenges.filter((c) => {
          if (c && c.id && isChallengeDeleted(c.id)) {
            apiDeleteChallenge(c.id).catch(() => {})
            return false
          }
          return c && c.id
        })
        const local = storage.getChallenges()

        const challengeMap = new Map<string, Challenge>()
        cleanRemote.forEach((c) => challengeMap.set(c.id, c))

        let needsPushChallenges = false
        local.forEach((l) => {
          if (!l || !l.id || isChallengeDeleted(l.id)) return
          if (!challengeMap.has(l.id)) {
            // Local challenge exists and hasn't been deleted: preserve it and push up!
            challengeMap.set(l.id, l)
            needsPushChallenges = true
          }
        })

        const mergedChallenges = Array.from(challengeMap.values())
        const localSig = local.map((c) => `${c.id}:${c.title}:${c.password}`).sort().join('|')
        const mergedSig = mergedChallenges.map((c) => `${c.id}:${c.title}:${c.password}`).sort().join('|')

        if (localSig !== mergedSig) {
          try {
            localStorage.setItem(KEYS.CHALLENGES, JSON.stringify(mergedChallenges))
          } catch {}
          broadcastStateChange('CHALLENGES_UPDATED')
          onSyncEvent?.('CHALLENGES_UPDATED')
        }

        if (needsPushChallenges && mergedChallenges.length > 0) {
          apiSyncChallenges(mergedChallenges).catch(() => {})
        }
      }

      // Reconcile Scores (Never wipe locally recorded scores!)
      if (remoteScores && Array.isArray(remoteScores)) {
        const local = storage.getScores()
        const scoreMap = new Map<string, ScoreEntry>()

        // 1. Index remote scores
        remoteScores.forEach((s) => {
          if (s && s.id) scoreMap.set(s.id, s)
        })

        // 2. Preserve any local scores that remote doesn't have yet
        let needsPushScores = false
        local.forEach((l) => {
          if (!l || !l.id) return
          if (!scoreMap.has(l.id)) {
            scoreMap.set(l.id, l)
            needsPushScores = true
          }
        })

        const mergedScores = Array.from(scoreMap.values()).sort((a, b) => (b.score || 0) - (a.score || 0))
        const localSig = local.map((s) => `${s.id}:${s.score}`).join('|')
        const mergedSig = mergedScores.map((s) => `${s.id}:${s.score}`).join('|')

        if (localSig !== mergedSig) {
          localStorage.setItem(KEYS.SCORES, JSON.stringify(mergedScores))
          broadcastStateChange('SCORES_UPDATED')
          onSyncEvent?.('SCORES_UPDATED')
        }

        if (needsPushScores && mergedScores.length > 0) {
          apiSyncScores(mergedScores).catch(() => {})
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
