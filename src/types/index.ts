export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Insane'

export type HintType = 'text' | 'image'

export interface HintItem {
  type: HintType
  content: string // text string OR image URL / base64 data URI
  caption?: string // optional description or note for the hint
  unlockAfterSeconds?: number // elapsed seconds into mission when this hint auto-reveals
}

export interface Challenge {
  id: string
  title: string
  category: string
  password: string
  caseSensitive?: boolean
  hints: [string, string, string, string, string]
  hintItems?: HintItem[]
  hintIntervalSeconds?: number // interval (e.g. 45s or 60s) to progressively release hints
  imageUrl?: string
  isImageClue?: boolean
  visualClueUnlockSeconds?: number // elapsed seconds when visual clue reveals
  timeLimit: number // in seconds
  difficulty: Difficulty
  isActive: boolean
  createdAt: string
}

export type SessionStatus = 'lobby' | 'playing' | 'ended'

export interface GameSession {
  id: string
  challengeId: string
  joinCode: string
  status: SessionStatus
  startedAt?: number // timestamp
  totalSeconds: number
  remainingSeconds: number
  winnerName?: string
  winnerScore?: number
  forceUnlockedHints?: number[] // indices of hints manually revealed by admin
  createdAt: string
}

export type PlayerStatus = 'waiting' | 'playing' | 'solved' | 'failed'

export interface GamePlayer {
  id: string
  sessionId: string
  name: string
  avatar: string
  status: PlayerStatus
  attempts: number
  hintsUsed: number // count of hints revealed (0 - 6)
  revealedHints: number[] // e.g. [0, 1, 5]
  solveTime?: number // seconds taken to solve
  score?: number
  joinedAt: string
}

export interface ScoreEntry {
  id: string
  challengeTitle: string
  playerName: string
  score: number
  timeTaken: number
  attempts: number
  hintsRevealed: number
  createdAt: string
}

export interface AppSettings {
  adminUsername?: string
  adminPassword: string
  defaultTimeLimit: number
  soundEnabled: boolean
}

export interface AttemptLog {
  id: string
  guess: string
  isCorrect: boolean
  timestamp: string
  feedback: string
}
