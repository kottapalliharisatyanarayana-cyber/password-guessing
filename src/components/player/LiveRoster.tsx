import React from 'react'
import { GamePlayer } from '../../types'
import { Users, Zap, Eye, Trophy, CheckCircle2 } from 'lucide-react'
import { deduplicatePlayersByName } from '../../lib/storage'

interface LiveRosterProps {
  players: GamePlayer[]
  currentPlayerId: string
  currentScoreProjection: number
  totalSeconds?: number
}

export const LiveRoster: React.FC<LiveRosterProps> = ({
  players,
  currentPlayerId,
  currentScoreProjection,
  totalSeconds = 300
}) => {
  // Sort players: Solved players with lowest solve time rank #1 (fastest first)
  const uniquePlayers = deduplicatePlayersByName(players).sort((a, b) => {
    if (a.status === 'solved' && b.status !== 'solved') return -1
    if (b.status === 'solved' && a.status !== 'solved') return 1
    if (a.status === 'solved' && b.status === 'solved') {
      const timeA = a.solveTime !== undefined ? a.solveTime : 99999
      const timeB = b.solveTime !== undefined ? b.solveTime : 99999
      if (timeA !== timeB) return timeA - timeB
      return (b.score || 0) - (a.score || 0)
    }
    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0)
    return a.attempts - b.attempts
  })

  return (
    <div className="glass-panel live-roster-panel" style={{ padding: '1.25rem', height: '100%' }}>
      {/* Projected Score Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(0, 245, 160, 0.08) 0%, rgba(0, 216, 246, 0.08) 100%)',
          border: '1px solid rgba(0, 245, 160, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          marginBottom: '1.25rem',
          textAlign: 'center'
        }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Live Score Projection
        </span>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, color: 'var(--neon-mint)', textShadow: '0 0 16px rgba(0, 245, 160, 0.4)' }}>
          {currentScoreProjection.toLocaleString()} <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>pts</span>
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Speed bonus decays as clock ticks • Complete fast to finish #1!
        </span>
      </div>

      {/* Opponents Heading */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <h4 style={{ fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Trophy size={16} style={{ color: 'var(--neon-amber)' }} />
          Live Standings ({uniquePlayers.length})
        </h4>
        <span className="pulse-dot" />
      </div>

      {/* Competitors List */}
      <div className="competitors-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '380px', overflowY: 'auto' }}>
        {uniquePlayers.map((p, idx) => {
          const isYou = p.id === currentPlayerId
          const isSolved = p.status === 'solved'
          const rank = idx + 1
          const rankMedal = rank === 1 && isSolved ? '🥇 #1' : rank === 2 && isSolved ? '🥈 #2' : rank === 3 && isSolved ? '🥉 #3' : `#${rank}`

          return (
            <div
              key={p.id}
              className="competitor-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: isYou ? 'rgba(0, 245, 160, 0.08)' : isSolved ? 'rgba(245, 158, 11, 0.06)' : 'rgba(10, 15, 29, 0.5)',
                border: isYou ? '1px solid rgba(0, 245, 160, 0.3)' : isSolved ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--border-subtle)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: isSolved ? 'var(--neon-amber)' : 'var(--text-muted)', width: '28px' }}>
                  {rankMedal}
                </div>

                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: isYou ? 'var(--neon-mint-dim)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isYou ? 'var(--neon-mint)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: isYou ? 'var(--neon-mint)' : '#cbd5e1'
                  }}
                >
                  {p.avatar || p.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {p.name}
                    {isYou && <span className="badge badge-mint" style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>YOU</span>}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '0.65rem', marginTop: '0.15rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <Zap size={11} /> {p.attempts} {p.attempts === 1 ? 'try' : 'tries'}
                    </span>
                    {p.solveTime !== undefined && (
                      <span style={{ color: 'var(--neon-amber)', fontWeight: 600 }}>
                        ⚡ {p.solveTime}s
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div>
                {isSolved ? (
                  <span className="badge badge-mint" style={{ fontSize: '0.65rem' }}>
                    <CheckCircle2 size={11} /> {p.score ? `${p.score} pts` : 'CRACKED'}
                  </span>
                ) : p.status === 'failed' ? (
                  <span className="badge badge-crimson" style={{ fontSize: '0.65rem' }}>
                    LOCKED OUT
                  </span>
                ) : (
                  <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
                    RACING
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
