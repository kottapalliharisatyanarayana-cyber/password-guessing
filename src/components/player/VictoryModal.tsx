import React, { useEffect } from 'react'
import { launchConfetti } from '../../lib/confetti'
import { calculateHintPenalty } from '../../lib/storage'
import { Trophy, Zap, Eye, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react'

interface VictoryModalProps {
  isOpen: boolean
  isWinner: boolean
  winnerName?: string
  score: number
  timeTaken?: number
  totalSeconds?: number
  attempts: number
  hintsUsed: number
  revealedHints?: number[]
  onGoToLeaderboard: () => void
  onPlayAgain: () => void
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  isOpen,
  isWinner,
  winnerName,
  score,
  timeTaken,
  totalSeconds = 300,
  attempts,
  hintsUsed,
  revealedHints,
  onGoToLeaderboard,
  onPlayAgain
}) => {
  useEffect(() => {
    if (isOpen && isWinner) {
      launchConfetti()
    }
  }, [isOpen, isWinner])

  if (!isOpen) return null

  const attemptPenalty = Math.max(0, attempts - 1) * 50
  const validTotal = Math.max(totalSeconds || 300, 1)
  const elapsed = timeTaken !== undefined && timeTaken > 0 ? timeTaken : 0
  const remainingSec = Math.max(0, validTotal - elapsed)
  const speedBonus = isWinner ? Math.round((remainingSec / validTotal) * 5000) : 0

  return (
    <div className="modal-overlay">
      <div className="modal-content victory-modal-content" style={{ maxWidth: '520px', textAlign: 'center', position: 'relative' }}>
        {/* Glow Header */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: isWinner ? 'rgba(0, 245, 160, 0.15)' : 'rgba(255, 51, 102, 0.15)',
            border: `1px solid ${isWinner ? 'var(--neon-mint)' : 'var(--neon-crimson)'}`,
            color: isWinner ? 'var(--neon-mint)' : 'var(--neon-crimson)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: isWinner ? 'var(--shadow-glow)' : 'var(--shadow-crimson)'
          }}
        >
          {isWinner ? <Trophy size={32} /> : <ShieldCheck size={32} />}
        </div>

        <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '0.35rem', color: '#fff' }}>
          {isWinner ? 'VAULT COMPROMISED!' : 'ROUND CONCLUDED'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
          {isWinner
            ? `First-place breach authenticated in ${elapsed}s! You cracked the system fastest.`
            : `Vault breached by ${winnerName || 'another player'}. Better luck in the next session!`}
        </p>

        {/* Final Score Hero */}
        <div
          style={{
            background: 'rgba(6, 9, 16, 0.8)',
            border: '1px solid var(--border-glow)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.25rem',
            marginBottom: '1.5rem'
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Final Verified Score
          </span>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', fontWeight: 900, color: 'var(--neon-mint)', textShadow: '0 0 20px rgba(0, 245, 160, 0.4)' }}>
            {score.toLocaleString()} <span style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>pts</span>
          </div>

          {/* Time-Based Breakdown Equation */}
          <div
            className="victory-breakdown-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.75rem',
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '0.78rem'
            }}
          >
            <div>
              <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <CheckCircle2 size={12} style={{ color: 'var(--neon-mint)' }} /> Base Score
              </div>
              <strong style={{ color: 'var(--neon-mint)' }}>5,000 pts</strong>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <Zap size={12} style={{ color: 'var(--neon-amber)' }} /> Speed ({elapsed}s)
              </div>
              <strong style={{ color: 'var(--neon-amber)' }}>
                +{speedBonus.toLocaleString()} pts
              </strong>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                <Eye size={12} /> Guesses ({attempts})
              </div>
              <strong style={{ color: attemptPenalty > 0 ? 'var(--neon-crimson)' : 'var(--neon-mint)' }}>
                {attemptPenalty > 0 ? `-${attemptPenalty} pts` : '0 pts'}
              </strong>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button className="btn-secondary" onClick={onPlayAgain}>
            Return to Lobby
          </button>
        </div>
      </div>
    </div>
  )
}
