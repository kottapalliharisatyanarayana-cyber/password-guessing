import React, { useState, useEffect } from 'react'
import { GameSession, Challenge, GamePlayer } from '../../types'
import { sound } from '../../lib/sound'
import { supabaseRequestSync } from '../../lib/supabase'
import { Shield, KeyRound, User, Users, Play, Radio, Sparkles, Loader2 } from 'lucide-react'

interface PlayerLobbyProps {
  sessions: GameSession[]
  challenges: Challenge[]
  players: GamePlayer[]
  onJoinSession: (sessionCode: string, playerName: string, avatar: string) => void
  currentWaitingSession?: GameSession | null
  currentWaitingPlayer?: GamePlayer | null
  onLeaveWaiting?: () => void
  initialCode?: string
}

const AVATARS = ['⚡', '💀', '👾', '🛸', '🐺', '🕶️', '🎯', '🔥', '🤖', '🦊']

export const PlayerLobby: React.FC<PlayerLobbyProps> = ({
  sessions,
  challenges,
  players,
  onJoinSession,
  currentWaitingSession,
  currentWaitingPlayer,
  onLeaveWaiting,
  initialCode
}) => {
  const [code, setCode] = useState(initialCode || '')
  const [name, setName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  // Request cloud sync when opening lobby
  useEffect(() => {
    supabaseRequestSync()
    const timer = setInterval(() => supabaseRequestSync(), 3000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode.toUpperCase())
      supabaseRequestSync()
    }
  }, [initialCode])

  // Find active joinable sessions
  const joinableSessions = sessions.filter((s) => s.status !== 'ended')

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanCode = code.trim().toUpperCase()
    const cleanName = name.trim()

    if (!cleanCode) {
      setErrorMsg('Please enter a 6-character room PIN')
      return
    }
    if (!cleanName) {
      setErrorMsg('Please enter your player callsign')
      return
    }

    const targetSession = sessions.find((s) => s.joinCode.toUpperCase() === cleanCode)
    if (!targetSession) {
      // Trigger cloud sync and retry after 400ms
      setIsSearching(true)
      supabaseRequestSync()
      setTimeout(() => {
        setIsSearching(false)
        const recheck = sessions.find((s) => s.joinCode.toUpperCase() === cleanCode)
        if (recheck) {
          sound.playClick()
          setErrorMsg(null)
          onJoinSession(cleanCode, cleanName, selectedAvatar)
        } else {
          setErrorMsg(`No active room found with PIN "${cleanCode}". Make sure the host has created the room.`)
          sound.playError()
        }
      }, 500)
      return
    }

    sound.playClick()
    setErrorMsg(null)
    onJoinSession(cleanCode, cleanName, selectedAvatar)
  }

  const handleSelectSession = (s: GameSession) => {
    setCode(s.joinCode)
    sound.playClick()
  }

  // If in waiting state (waiting for admin to start)
  if (currentWaitingSession && currentWaitingPlayer) {
    const challenge = challenges.find((c) => c.id === currentWaitingSession.challengeId)
    const sessionPlayers = players.filter((p) => p.sessionId === currentWaitingSession.id)

    return (
      <div style={{ maxWidth: '640px', margin: '2rem auto', textAlign: 'center' }}>
        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <div className="pulse-dot" style={{ margin: '0 auto 1.5rem', width: '14px', height: '14px' }} />
          <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '0.5rem', color: '#fff' }}>
            Awaiting Admin Signal...
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '1.75rem' }}>
            You are in the waiting lobby for <strong style={{ color: 'var(--neon-mint)' }}>{challenge?.title || 'Unknown Vault'}</strong>.
            The race begins when the mission administrator hits Start!
          </p>

          <div
            style={{
              background: 'rgba(6, 9, 16, 0.8)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
              marginBottom: '2rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Users size={16} style={{ color: 'var(--neon-cyan)' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Contestants In Lobby ({sessionPlayers.length})</span>
              </div>
              <span className="badge badge-mint" style={{ fontSize: '0.7rem' }}>
                ROOM: {currentWaitingSession.joinCode}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', justifyContent: 'center' }}>
              {sessionPlayers.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: p.id === currentWaitingPlayer.id ? 'rgba(0, 245, 160, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    border: p.id === currentWaitingPlayer.id ? '1px solid var(--neon-mint)' : '1px solid var(--border-subtle)',
                    padding: '0.5rem 0.85rem',
                    borderRadius: 'var(--radius-full)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.85rem'
                  }}
                >
                  <span>{p.avatar}</span>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  {p.id === currentWaitingPlayer.id && <span style={{ color: 'var(--neon-mint)', fontSize: '0.7rem' }}>(YOU)</span>}
                </div>
              ))}
            </div>
          </div>

          <button className="btn-secondary" onClick={onLeaveWaiting}>
            Exit Lobby
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in-up" style={{ maxWidth: '580px', margin: '2rem auto' }}>
      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            className="animate-float"
            style={{
              width: '60px',
              height: '60px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, rgba(0, 245, 160, 0.25), rgba(0, 216, 246, 0.25))',
              border: '1px solid var(--neon-mint)',
              color: 'var(--neon-mint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              boxShadow: '0 0 25px rgba(0, 245, 160, 0.35)'
            }}
          >
            <KeyRound size={30} />
          </div>
          <h2 style={{ fontSize: '1.95rem', fontFamily: 'var(--font-display)', marginBottom: '0.4rem', color: '#fff', letterSpacing: '0.04em' }}>
            Enter The Vault
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Enter your 6-character room PIN to join the multiplayer cracking competition.
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 51, 102, 0.15)',
              border: '1px solid var(--neon-crimson)',
              color: 'var(--neon-crimson)',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              textAlign: 'center'
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleJoin}>
          {/* Room PIN Input */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Room PIN (6 Characters)
            </label>
            <input
              type="text"
              className="input-field"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. CHIM84"
              maxLength={8}
              style={{
                fontSize: '1.35rem',
                textAlign: 'center',
                letterSpacing: '0.2em',
                fontWeight: 800,
                color: 'var(--neon-mint)'
              }}
            />
          </div>

          {/* Quick Select Available Live Sessions or Clean Standby Status */}
          {joinableSessions.length > 0 ? (
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.45rem', textTransform: 'uppercase' }}>
                Active Game Rooms:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {joinableSessions.map((s) => {
                  const ch = challenges.find((c) => c.id === s.challengeId)
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleSelectSession(s)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.75rem',
                        borderColor: code === s.joinCode ? 'var(--neon-mint)' : undefined,
                        background: code === s.joinCode ? 'rgba(0, 245, 160, 0.12)' : undefined
                      }}
                    >
                      <Radio size={12} style={{ color: 'var(--neon-mint)' }} />
                      <strong>{s.joinCode}</strong> ({ch?.title || 'Session'})
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0, 245, 160, 0.03)',
                border: '1px dashed rgba(0, 245, 160, 0.22)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                fontSize: '0.76rem',
                color: 'var(--text-secondary)'
              }}
            >
              <span className="pulse-dot" style={{ width: '6px', height: '6px' }} />
              <span>READY TO PLAY // ENTER HOST PIN OR SCAN QR CODE TO JOIN</span>
            </div>
          )}

          {/* Callsign / Name */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your Player Name
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="text"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Neo, CyberValk, Ghost-9"
                maxLength={24}
              />
            </div>
          </div>

          {/* Avatar Picker */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Choose Cyber Avatar
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', justifyContent: 'center' }}>
              {AVATARS.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => {
                    setSelectedAvatar(av)
                    sound.playClick()
                  }}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: 'var(--radius-md)',
                    background: selectedAvatar === av ? 'rgba(0, 245, 160, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: selectedAvatar === av ? '1px solid var(--neon-mint)' : '1px solid var(--border-subtle)',
                    fontSize: '1.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: selectedAvatar === av ? 'var(--shadow-glow)' : 'none'
                  }}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Join Submit */}
          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: '0.85rem', fontSize: '1rem' }}
          >
            <Play size={18} /> Join Vault Race
          </button>
        </form>
      </div>
    </div>
  )
}
