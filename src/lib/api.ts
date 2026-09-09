import { GameSession, Challenge, GamePlayer, ScoreEntry } from '../types'

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '/api'
  const host = window.location.hostname

  // 1. Explicit override if set via environment variable
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl && !envUrl.includes('localhost')) {
    return envUrl
  }

  // 2. Localhost development
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:5000/api'
  }

  // 3. Local Area Network (Wi-Fi IP e.g. 10.118.105.29)
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    return `http://${host}:5000/api`
  }

  // 4. Production Cloud (Vercel / custom domain): use relative /api
  return '/api'
}

export const API_BASE_URL = getApiBaseUrl()

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const url = `${API_BASE_URL}${endpoint}`
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    })
    if (!res.ok) {
      return null
    }
    return (await res.json()) as T
  } catch {
    // Return null if backend server is not running or unreachable
    return null
  }
}

// Health
export async function apiCheckHealth(): Promise<{
  status: string
  database?: { status: string; name?: string; host?: string }
} | null> {
  return request('/health')
}

// Sessions
export async function apiGetSessions(): Promise<GameSession[] | null> {
  return request<GameSession[]>('/sessions')
}

export async function apiGetSessionByCode(joinCode: string): Promise<GameSession | null> {
  return request<GameSession>(`/sessions/code/${encodeURIComponent(joinCode)}`)
}

export async function apiSaveSession(session: GameSession): Promise<GameSession | null> {
  return request<GameSession>('/sessions', {
    method: 'POST',
    body: JSON.stringify(session)
  })
}

export async function apiSyncSessions(sessions: GameSession[]): Promise<GameSession[] | null> {
  return request<GameSession[]>('/sessions/batch', {
    method: 'POST',
    body: JSON.stringify(sessions)
  })
}

export async function apiUpdateSession(id: string, updates: Partial<GameSession>): Promise<GameSession | null> {
  return request<GameSession>(`/sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  })
}

export async function apiDeleteSession(id: string): Promise<boolean> {
  const res = await request<{ success: boolean }>(`/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  })
  return !!res?.success
}

// Players
export async function apiGetPlayers(sessionId?: string): Promise<GamePlayer[] | null> {
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
  return request<GamePlayer[]>(`/players${query}`)
}

export async function apiSavePlayer(player: GamePlayer): Promise<GamePlayer | null> {
  return request<GamePlayer>('/players', {
    method: 'POST',
    body: JSON.stringify(player)
  })
}

export async function apiSyncPlayers(players: GamePlayer[]): Promise<GamePlayer[] | null> {
  return request<GamePlayer[]>('/players/batch', {
    method: 'POST',
    body: JSON.stringify(players)
  })
}

// Challenges
export async function apiGetChallenges(): Promise<Challenge[] | null> {
  return request<Challenge[]>('/challenges')
}

export async function apiSyncChallenges(challenges: Challenge[]): Promise<Challenge[] | null> {
  return request<Challenge[]>('/challenges/batch', {
    method: 'POST',
    body: JSON.stringify(challenges)
  })
}

// Scores
export async function apiGetScores(sessionId?: string): Promise<ScoreEntry[] | null> {
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''
  return request<ScoreEntry[]>(`/scores${query}`)
}

export async function apiSaveScore(score: ScoreEntry): Promise<ScoreEntry | null> {
  return request<ScoreEntry>('/scores', {
    method: 'POST',
    body: JSON.stringify(score)
  })
}

export async function apiSyncScores(scores: ScoreEntry[]): Promise<ScoreEntry[] | null> {
  return request<ScoreEntry[]>('/scores/batch', {
    method: 'POST',
    body: JSON.stringify(scores)
  })
}
