import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import { Challenge, GameSession, GamePlayer, ScoreEntry, AppSettings } from '../types'

export const DEFAULT_SUPABASE_URL = 'https://dxygamtlhojyblzwbsyf.supabase.co'
const STORAGE_KEY_SUPABASE_KEY = 'crackvault_supabase_anon_key'
const STORAGE_KEY_SUPABASE_URL = 'crackvault_supabase_url'

export function getSupabaseUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const custom = localStorage.getItem(STORAGE_KEY_SUPABASE_URL)
    if (custom) return custom
  }
  return import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
}

export function getSupabaseAnonKey(): string {
  if (typeof localStorage !== 'undefined') {
    const custom = localStorage.getItem(STORAGE_KEY_SUPABASE_KEY)
    if (custom) return custom
  }
  return import.meta.env.VITE_SUPABASE_ANON_KEY || ''
}

export function saveSupabaseCredentials(url: string, anonKey: string) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_SUPABASE_URL, url.trim())
    localStorage.setItem(STORAGE_KEY_SUPABASE_KEY, anonKey.trim())
    clientInstance = null
    realtimeChannel = null
    initSupabase()
  }
}

export function clearSupabaseCredentials() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_SUPABASE_URL)
    localStorage.removeItem(STORAGE_KEY_SUPABASE_KEY)
    if (realtimeChannel) {
      realtimeChannel.unsubscribe()
    }
    clientInstance = null
    realtimeChannel = null
  }
}

let clientInstance: SupabaseClient | null = null
let realtimeChannel: RealtimeChannel | null = null

export function initSupabase(): SupabaseClient | null {
  if (clientInstance) return clientInstance

  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()

  if (!url || !key) {
    return null
  }

  try {
    clientInstance = createClient(url, key, {
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    })
    return clientInstance
  } catch (err) {
    console.warn('Supabase initialization error:', err)
    return null
  }
}

export function isSupabaseConnected(): boolean {
  return initSupabase() !== null
}

// --- SUPABASE REALTIME BROADCAST CHANNEL ---

type BroadcastHandler = (data: any) => void
const listeners: Record<string, BroadcastHandler[]> = {
  SESSIONS_SYNC: [],
  PLAYERS_SYNC: [],
  CHALLENGES_SYNC: [],
  SCORES_SYNC: [],
  SETTINGS_SYNC: []
}

export function initSupabaseRealtime(onSyncEvent?: (type: string) => void): () => void {
  const client = initSupabase()
  if (!client) return () => {}

  if (realtimeChannel) {
    realtimeChannel.unsubscribe()
  }

  realtimeChannel = client.channel('crackvault_global_room', {
    config: { broadcast: { self: false } }
  })

  // Listen to incoming broadcasts from any device on the internet
  realtimeChannel
    .on('broadcast', { event: 'SESSIONS_SYNC' }, ({ payload }) => {
      listeners.SESSIONS_SYNC.forEach((fn) => fn(payload))
      onSyncEvent?.('SESSIONS_UPDATED')
    })
    .on('broadcast', { event: 'PLAYERS_SYNC' }, ({ payload }) => {
      listeners.PLAYERS_SYNC.forEach((fn) => fn(payload))
      onSyncEvent?.('PLAYERS_UPDATED')
    })
    .on('broadcast', { event: 'CHALLENGES_SYNC' }, ({ payload }) => {
      listeners.CHALLENGES_SYNC.forEach((fn) => fn(payload))
      onSyncEvent?.('CHALLENGES_UPDATED')
    })
    .on('broadcast', { event: 'SCORES_SYNC' }, ({ payload }) => {
      listeners.SCORES_SYNC.forEach((fn) => fn(payload))
      onSyncEvent?.('SCORES_UPDATED')
    })

  realtimeChannel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('⚡ Supabase Realtime connected: Listening for cross-device events')
    }
  })

  return () => {
    if (realtimeChannel) {
      realtimeChannel.unsubscribe()
      realtimeChannel = null
    }
  }
}

export function subscribeSupabaseEvent(event: keyof typeof listeners, callback: BroadcastHandler) {
  if (listeners[event]) {
    listeners[event].push(callback)
  }
  return () => {
    listeners[event] = listeners[event].filter((fn) => fn !== callback)
  }
}

// --- BROADCAST EMITTERS ---

export async function supabaseBroadcastSessions(sessions: GameSession[]): Promise<void> {
  if (realtimeChannel) {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'SESSIONS_SYNC',
      payload: sessions
    })
  }
}

export async function supabaseBroadcastPlayers(players: GamePlayer[]): Promise<void> {
  if (realtimeChannel) {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'PLAYERS_SYNC',
      payload: players
    })
  }
}

export async function supabaseBroadcastChallenges(challenges: Challenge[]): Promise<void> {
  if (realtimeChannel) {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'CHALLENGES_SYNC',
      payload: challenges
    })
  }
}

export async function supabaseBroadcastScores(scores: ScoreEntry[]): Promise<void> {
  if (realtimeChannel) {
    await realtimeChannel.send({
      type: 'broadcast',
      event: 'SCORES_SYNC',
      payload: scores
    })
  }
}
