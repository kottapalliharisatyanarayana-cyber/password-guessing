import React, { useState } from 'react'
import { Challenge, GameSession, GamePlayer, ScoreEntry } from '../types'
import { PlayerLobby } from '../components/player/PlayerLobby'
import { PlayerArena } from '../components/player/PlayerArena'
import { LeaderboardView } from '../components/admin/LeaderboardView'
import { Shield, Volume2, VolumeX, Trophy, X, Lock } from 'lucide-react'
import { sound } from '../lib/sound'

interface PlayerPageProps {
  sessions: GameSession[]
  challenges: Challenge[]
  players: GamePlayer[]
  scores: ScoreEntry[]
  activeSessionId: string | null
  currentSession?: GameSession
  currentChallenge?: Challenge
  currentPlayer?: GamePlayer
  currentSessionPlayers: GamePlayer[]
  initialJoinCode: string
  cloudConnected: boolean
  soundEnabled: boolean
  onToggleSound: () => void
  onJoinSession: (code: string, name: string, avatar: string) => void
  onPlayerGuessAttempt: (isCorrect: boolean, guess: string, solveSeconds?: number) => void
  onPlayerRevealHint: (hintIndex: number) => void
  onLeaveGame: () => void
  onNavigateToAdmin: () => void
}

export const PlayerPage: React.FC<PlayerPageProps> = ({
  sessions,
  challenges,
  players,
  scores,
  activeSessionId,
  currentSession,
  currentChallenge,
  currentPlayer,
  currentSessionPlayers,
  initialJoinCode,
  cloudConnected,
  soundEnabled,
  onToggleSound,
  onJoinSession,
  onPlayerGuessAttempt,
  onPlayerRevealHint,
  onLeaveGame,
  onNavigateToAdmin
}) => {
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const activeSessionCount = sessions.filter((s) => s.status === 'playing').length
  const isDirectEvent = Boolean(initialJoinCode && initialJoinCode.trim().length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Dedicated Player Navigation Bar */}
      <header className="app-header">
        {/* Brand */}
        <div className="brand-group">
          <div className="brand-icon">
            <Shield size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-title">
              CRACK<span>VAULT</span>
            </div>
          </div>
          <div style={{ marginLeft: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-mint" style={{ fontSize: '0.65rem' }}>
              <span className="pulse-dot" style={{ width: '5px', height: '5px' }} />
              {activeSessionCount > 0 ? `${activeSessionCount} LIVE` : 'STANDBY'}
            </span>
            <span
              className={`badge ${cloudConnected ? 'badge-cyan' : ''}`}
              style={{
                fontSize: '0.65rem',
                background: cloudConnected ? undefined : 'rgba(255,255,255,0.05)',
                color: cloudConnected ? undefined : 'var(--text-muted)'
              }}
              title={cloudConnected ? 'Connected to MongoDB Atlas & Express backend' : 'Local storage mode'}
            >
              {cloudConnected ? '⚡ MONGO ATLAS' : 'LOCAL'}
            </span>
          </div>
        </div>

        {/* Right Controls for Players */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            className="btn-secondary"
            onClick={() => {
              setShowLeaderboard(true)
              sound.playClick()
            }}
            style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Trophy size={14} style={{ color: 'var(--neon-amber)' }} /> Leaderboard
          </button>
          <button
            className="btn-icon"
            onClick={() => {
              onToggleSound()
              sound.playClick()
            }}
            title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
            style={{
              borderColor: soundEnabled ? 'rgba(0, 245, 160, 0.3)' : undefined,
              color: soundEnabled ? 'var(--neon-mint)' : undefined
            }}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </header>

      {/* Main Contestant Area */}
      <main className="main-wrapper" style={{ flex: 1 }}>
        {activeSessionId && currentSession && currentPlayer ? (
          currentSession.status === 'lobby' ? (
            <PlayerLobby
              sessions={sessions}
              challenges={challenges}
              players={currentSessionPlayers}
              onJoinSession={onJoinSession}
              currentWaitingSession={currentSession}
              currentWaitingPlayer={currentPlayer}
              onLeaveWaiting={onLeaveGame}
              onGoToAdmin={onNavigateToAdmin}
            />
          ) : (
            <PlayerArena
              session={currentSession}
              challenge={currentChallenge!}
              player={currentPlayer}
              players={currentSessionPlayers}
              onGuessAttempt={onPlayerGuessAttempt}
              onRevealHint={onPlayerRevealHint}
              onLeaveGame={onLeaveGame}
              onGoToLeaderboard={() => setShowLeaderboard(true)}
            />
          )
        ) : (
          <PlayerLobby
            sessions={sessions}
            challenges={challenges}
            players={players}
            onJoinSession={onJoinSession}
            initialCode={initialJoinCode}
            onGoToAdmin={isDirectEvent ? undefined : onNavigateToAdmin}
          />
        )}
      </main>

      {/* Global Leaderboard Modal */}
      {showLeaderboard && (
        <div className="modal-overlay" onClick={() => setShowLeaderboard(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '850px', width: '92%', maxHeight: '88vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
              <button
                className="btn-secondary"
                onClick={() => setShowLeaderboard(false)}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <X size={14} /> Close
              </button>
            </div>
            <LeaderboardView
              scores={scores}
              readOnly={true}
              onClearLeaderboard={() => {}}
              onNotify={() => {}}
            />
          </div>
        </div>
      )}

      {/* Discrete Contestant Footer */}
      <footer
        style={{
          marginTop: 'auto',
          padding: '1rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          background: 'rgba(6, 9, 16, 0.65)',
          backdropFilter: 'blur(8px)',
          position: 'relative',
          zIndex: 10,
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div>
          <span>CRACKVAULT © {new Date().getFullYear()} • Multiplayer Decryption Arena</span>
        </div>
        <div>
          {!isDirectEvent && (
            <button
              onClick={onNavigateToAdmin}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                opacity: 0.5,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
              title="Host / Admin Command Portal"
            >
              <Lock size={12} /> Host Login →
            </button>
          )}
        </div>
      </footer>
    </div>
  )
}
