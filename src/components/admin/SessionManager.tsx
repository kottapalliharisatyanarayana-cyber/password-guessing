import React, { useState, useEffect } from 'react'
import { GameSession, Challenge, GamePlayer } from '../../types'
import { generateQrDataUrl } from '../../lib/qr'
import { sound } from '../../lib/sound'
import {
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Plus,
  QrCode,
  Users,
  Clock,
  Zap,
  Eye,
  Radio,
  Copy,
  ExternalLink,
  Bot,
  Download,
  Check
} from 'lucide-react'

interface SessionManagerProps {
  sessions: GameSession[]
  challenges: Challenge[]
  players: GamePlayer[]
  onStartSession: (sessionId: string) => void
  onPauseSession: (sessionId: string) => void
  onResumeSession: (sessionId: string) => void
  onResetSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onCreateSession: (challengeId: string, customTime?: number) => void
  onSimulateBot: (sessionId: string) => void
  onNotify: (msg: string) => void
  onForceRevealNextHint?: (sessionId: string) => void
  onGoToChallenges?: () => void
}

export const SessionManager: React.FC<SessionManagerProps> = ({
  sessions,
  challenges,
  players,
  onStartSession,
  onPauseSession,
  onResumeSession,
  onResetSession,
  onDeleteSession,
  onCreateSession,
  onSimulateBot,
  onNotify,
  onForceRevealNextHint,
  onGoToChallenges
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedChallengeId, setSelectedChallengeId] = useState(challenges[0]?.id || '')
  const [qrModalSession, setQrModalSession] = useState<GameSession | null>(null)

  useEffect(() => {
    if (challenges.length > 0 && !challenges.some((c) => c.id === selectedChallengeId)) {
      setSelectedChallengeId(challenges[0].id)
    }
  }, [challenges, selectedChallengeId])

  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [qrHost, setQrHost] = useState<string>(
    typeof window !== 'undefined'
      ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? '10.10.65.21' : window.location.hostname)
      : '10.10.65.21'
  )
  const [qrPort, setQrPort] = useState<string>(
    typeof window !== 'undefined' && window.location.port ? window.location.port : '5173'
  )
  const [qrContrast, setQrContrast] = useState<'white' | 'cyber'>('white')

  useEffect(() => {
    if (!qrModalSession) {
      setQrDataUrl('')
      return
    }
    const targetUrl = `http://${qrHost}:${qrPort}/?join=${qrModalSession.joinCode}`
    const isWhite = qrContrast === 'white'
    generateQrDataUrl(targetUrl, {
      darkColor: isWhite ? '#000000' : '#00f5a0',
      lightColor: isWhite ? '#ffffff' : '#080d1a',
      width: 400,
      margin: 2
    })
      .then(setQrDataUrl)
      .catch(console.error)
  }, [qrModalSession, qrHost, qrPort, qrContrast])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedChallengeId) return
    onCreateSession(selectedChallengeId)
    setShowCreateModal(false)
    sound.playClick()
    onNotify('New session initiated')
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    sound.playClick()
    onNotify(`Room PIN "${code}" copied to clipboard!`)
  }

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div>
      {/* Action Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>Mission Control &amp; Sessions</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Orchestrate live game sessions, broadcast start signals, and view contestant scoreboards.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} /> Launch New Session
        </button>
      </div>

      {/* Sessions Grid */}
      {sessions.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
          <Radio size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.15rem', color: '#fff', marginBottom: '0.35rem' }}>No Active Game Sessions</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: '460px', margin: '0 auto 1.5rem' }}>
            {challenges.length === 0
              ? 'Your challenge workshop is clean with 0 challenges. Create your first challenge before opening a live session.'
              : 'Create a session from your challenge library to generate a PIN and QR code for players.'}
          </p>
          {challenges.length === 0 && onGoToChallenges ? (
            <button className="btn-primary" onClick={onGoToChallenges}>
              <Plus size={16} /> Open Challenge Workshop
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
              <Plus size={16} /> Launch Session Now
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {sessions.map((sess) => {
            const ch = sess.challenge || challenges.find((c) => c.id === sess.challengeId)
            const sessionPlayers = players.filter((p) => p.sessionId === sess.id || (p.joinCode && p.joinCode === sess.joinCode))

            // Hint Countdown computation
            const elapsed = Math.max(0, sess.totalSeconds - sess.remainingSeconds)
            const forceUnlocked = sess.forceUnlockedHints || []
            let nextHintToReveal: { index: number; label: string; countdown: number } | null = null
            let totalHintsCount = 0
            let unlockedCount = 0

            if (ch) {
              const defaultInterval = ch.hintIntervalSeconds || 45
              for (let i = 0; i < 5; i++) {
                const content = ch.hintItems?.[i]?.content || ch.hints[i]
                if (content?.trim()) {
                  totalHintsCount++
                  const unlockAt = ch.hintItems?.[i]?.unlockAfterSeconds ?? (i + 1) * defaultInterval
                  const isUnlocked = elapsed >= unlockAt || forceUnlocked.includes(i)
                  if (isUnlocked) {
                    unlockedCount++
                  } else if (!nextHintToReveal) {
                    nextHintToReveal = {
                      index: i,
                      label: `Clue #${i + 1}`,
                      countdown: Math.max(0, unlockAt - elapsed)
                    }
                  }
                }
              }
              if (ch.isImageClue && ch.imageUrl?.trim()) {
                totalHintsCount++
                const visualUnlock = ch.visualClueUnlockSeconds ?? Math.round(ch.timeLimit * 0.85)
                const isUnlocked = elapsed >= visualUnlock || forceUnlocked.includes(5)
                if (isUnlocked) {
                  unlockedCount++
                } else if (!nextHintToReveal) {
                  nextHintToReveal = {
                    index: 5,
                    label: 'Visual Dossier',
                    countdown: Math.max(0, visualUnlock - elapsed)
                  }
                }
              }
            }

            return (
              <div key={sess.id} className="glass-panel" style={{ padding: '1.75rem' }}>
                {/* Session Top Bar */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <span
                      className={`badge ${sess.status === 'playing' ? 'badge-mint' : sess.status === 'lobby' ? 'badge-amber' : 'badge-crimson'}`}
                      style={{ padding: '0.35rem 0.75rem' }}
                    >
                      {sess.status === 'playing' && <span className="pulse-dot" style={{ width: '6px', height: '6px' }} />}
                      {sess.status.toUpperCase()}
                    </span>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                        {ch?.title || 'Unknown Challenge'}
                      </h3>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', marginTop: '0.15rem' }}>
                        <span>Target: <code style={{ color: 'var(--neon-mint)' }}>{ch?.password}</code></span>
                        <span>•</span>
                        <span>Diff: <strong style={{ color: '#fff' }}>{ch?.difficulty}</strong></span>
                        <span>•</span>
                        <span>Created: {new Date(sess.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Room PIN & QR Button */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div
                      style={{
                        background: 'rgba(0, 245, 160, 0.08)',
                        border: '1px solid rgba(0, 245, 160, 0.3)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.45rem 0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem'
                      }}
                    >
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PIN:</span>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', color: 'var(--neon-mint)', letterSpacing: '0.08em' }}>
                        {sess.joinCode}
                      </strong>
                      <button className="btn-icon" style={{ width: '28px', height: '28px' }} onClick={() => copyCode(sess.joinCode)} title="Copy PIN">
                        <Copy size={13} />
                      </button>
                    </div>

                    <button className="btn-secondary" onClick={() => setQrModalSession(sess)}>
                      <QrCode size={16} /> Display QR
                    </button>
                  </div>
                </div>

                {/* Session Meta & Controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(6, 9, 16, 0.7)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem 1.25rem',
                    marginBottom: '1.25rem',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>CLOCK REMAINING</span>
                      <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: sess.status === 'playing' ? 'var(--neon-mint)' : '#cbd5e1' }}>
                        {formatSeconds(sess.remainingSeconds)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>CONTESTANTS</span>
                      <strong style={{ fontSize: '1.1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Users size={15} style={{ color: 'var(--neon-cyan)' }} />
                        {sessionPlayers.length} Connected
                      </strong>
                    </div>

                    {/* Hint Auto-Reveal Status */}
                    {sess.status === 'playing' && totalHintsCount > 0 && (
                      <div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block' }}>HINT REVEAL STATUS</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.15rem' }}>
                          <Clock size={13} style={{ color: nextHintToReveal ? 'var(--neon-amber)' : 'var(--neon-mint)' }} />
                          <strong style={{ fontSize: '0.92rem', color: nextHintToReveal ? 'var(--neon-amber)' : 'var(--neon-mint)', fontFamily: 'var(--font-mono)' }}>
                            {nextHintToReveal
                              ? `${nextHintToReveal.label} in ${formatSeconds(nextHintToReveal.countdown)}`
                              : 'All Hints Active'}
                          </strong>
                          <span className="badge badge-mint" style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>
                            {unlockedCount}/{totalHintsCount}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Controller Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {sess.status === 'lobby' && (
                      <button className="btn-primary" onClick={() => onStartSession(sess.id)}>
                        <Play size={15} /> Broadcast Start
                      </button>
                    )}
                    {sess.status === 'playing' && (
                      <button className="btn-secondary" onClick={() => onPauseSession(sess.id)}>
                        <Pause size={15} /> Pause
                      </button>
                    )}
                    {sess.status === 'ended' && (
                      <button className="btn-secondary" onClick={() => onResetSession(sess.id)}>
                        <RotateCcw size={15} /> Re-open Room
                      </button>
                    )}

                    {/* Force Reveal Next Hint to All Players */}
                    {sess.status === 'playing' && nextHintToReveal && onForceRevealNextHint && (
                      <button
                        className="btn-secondary"
                        onClick={() => onForceRevealNextHint(sess.id)}
                        title="Broadcast instant unlock of next progressive hint to all connected contestants"
                        style={{ color: 'var(--neon-amber)', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                      >
                        <Zap size={14} /> Reveal {nextHintToReveal.label} Now
                      </button>
                    )}

                    {/* Simulate Bot Player */}
                    <button
                      className="btn-secondary"
                      onClick={() => onSimulateBot(sess.id)}
                      title="Simulate bot guess and hint activity"
                      style={{ color: 'var(--neon-cyan)', borderColor: 'rgba(0, 216, 246, 0.3)' }}
                    >
                      <Bot size={15} /> Simulate Competitor
                    </button>

                    <button
                      className="btn-icon"
                      onClick={() => onDeleteSession(sess.id)}
                      style={{ color: 'var(--neon-crimson)' }}
                      title="Delete Session"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Live Player Scoreboard Table */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Live Scoreboard &amp; Status
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Updated in real time
                    </span>
                  </div>

                  {sessionPlayers.length === 0 ? (
                    <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No players connected to this lobby yet. Share the PIN or QR code above!
                    </div>
                  ) : (
                    <div style={{ background: 'rgba(6, 9, 16, 0.6)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
                            <th style={{ padding: '0.65rem 1rem' }}>Contestant</th>
                            <th style={{ padding: '0.65rem 1rem' }}>Status</th>
                            <th style={{ padding: '0.65rem 1rem' }}>Attempts</th>
                            <th style={{ padding: '0.65rem 1rem' }}>Hints Used</th>
                            <th style={{ padding: '0.65rem 1rem' }}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sessionPlayers.map((p) => (
                            <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <td style={{ padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: '#fff' }}>
                                <span>{p.avatar}</span> {p.name}
                              </td>
                              <td style={{ padding: '0.65rem 1rem' }}>
                                <span className={`badge ${p.status === 'solved' ? 'badge-mint' : p.status === 'failed' ? 'badge-crimson' : 'badge-cyan'}`} style={{ fontSize: '0.65rem' }}>
                                  {p.status.toUpperCase()}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 1rem', fontFamily: 'var(--font-mono)' }}>{p.attempts}</td>
                              <td style={{ padding: '0.65rem 1rem', fontFamily: 'var(--font-mono)' }}>{p.hintsUsed}</td>
                              <td style={{ padding: '0.65rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: p.score ? 'var(--neon-mint)' : 'var(--text-muted)' }}>
                                {p.score ? `${p.score} pts` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Launch Session Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-display)', marginBottom: '0.5rem', color: '#fff' }}>
              Launch New Challenge Session
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Choose a challenge from your library to open a live multiplayer cracking room.
            </p>

            {challenges.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid var(--neon-amber)',
                    color: 'var(--neon-amber)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem'
                  }}
                >
                  <Plus size={24} />
                </div>
                <h4 style={{ color: '#fff', fontSize: '1.05rem', marginBottom: '0.35rem' }}>
                  No Challenges In Workshop
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  You need to create at least one challenge before launching a session.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                    Close
                  </button>
                  {onGoToChallenges && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setShowCreateModal(false)
                        onGoToChallenges()
                      }}
                    >
                      <Plus size={15} /> Create Challenge Now
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', textTransform: 'uppercase' }}>
                    Select Target Challenge
                  </label>
                  <div style={{ display: 'grid', gap: '0.65rem', maxHeight: '240px', overflowY: 'auto' }}>
                    {challenges.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => setSelectedChallengeId(c.id)}
                        style={{
                          padding: '0.85rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          background: selectedChallengeId === c.id ? 'rgba(0, 245, 160, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                          border: selectedChallengeId === c.id ? '1px solid var(--neon-mint)' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '0.9rem' }}>{c.title}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {c.category} • {c.timeLimit}s • Pass: <code style={{ color: 'var(--neon-mint)' }}>{c.password}</code>
                          </span>
                        </div>
                        <span className={`badge ${c.difficulty === 'Insane' ? 'badge-crimson' : c.difficulty === 'Hard' ? 'badge-amber' : 'badge-mint'}`}>
                          {c.difficulty}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Launch Session
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Projector Mode QR Code Modal */}
      {qrModalSession && (
        <div className="modal-overlay" onClick={() => setQrModalSession(null)}>
          <div className="modal-content" style={{ maxWidth: '560px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <span className="badge badge-mint" style={{ marginBottom: '0.85rem' }}>
              PROJECTOR DISPLAY &amp; SCANNER MODE
            </span>
            <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '0.25rem', color: '#fff' }}>
              Scan To Crack The Vault
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
              Point any mobile camera or Google Lens to instantly open the player arena.
            </p>

            {/* Scannable QR Code Image */}
            <div
              style={{
                display: 'inline-block',
                padding: '1rem',
                background: qrContrast === 'white' ? '#ffffff' : '#080d1a',
                border: qrContrast === 'white' ? '4px solid #ffffff' : '1px solid var(--border-glow)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 0 30px rgba(0, 245, 160, 0.25)',
                marginBottom: '1rem',
                transition: 'all 0.2s ease'
              }}
            >
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR Code for ${qrModalSession.joinCode}`}
                  style={{
                    width: '240px',
                    height: '240px',
                    display: 'block',
                    borderRadius: '4px'
                  }}
                />
              ) : (
                <div style={{ width: '240px', height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  Generating QR Code...
                </div>
              )}
            </div>

            {/* Direct Join Link & Copy */}
            <div
              style={{
                background: 'rgba(6, 9, 16, 0.85)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                marginBottom: '1rem',
                fontSize: '0.82rem'
              }}
            >
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {`http://${qrHost}:${qrPort}/?join=${qrModalSession.joinCode}`}
              </span>
              <button
                className="btn-secondary"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', flexShrink: 0 }}
                onClick={() => {
                  const url = `http://${qrHost}:${qrPort}/?join=${qrModalSession.joinCode}`
                  navigator.clipboard.writeText(url)
                  sound.playClick()
                  onNotify('Join link copied to clipboard!')
                }}
              >
                <Copy size={13} /> Copy Link
              </button>
            </div>

            {/* Scanner Optimization & Host Network Settings */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  Network Host (for Mobile Wi-Fi Scan)
                </span>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    className={`btn-secondary ${qrContrast === 'white' ? 'active' : ''}`}
                    style={{
                      padding: '0.2rem 0.55rem',
                      fontSize: '0.7rem',
                      borderColor: qrContrast === 'white' ? 'var(--neon-mint)' : undefined,
                      color: qrContrast === 'white' ? 'var(--neon-mint)' : undefined
                    }}
                    onClick={() => setQrContrast('white')}
                  >
                    High Contrast (Recommended)
                  </button>
                  <button
                    className={`btn-secondary ${qrContrast === 'cyber' ? 'active' : ''}`}
                    style={{
                      padding: '0.2rem 0.55rem',
                      fontSize: '0.7rem',
                      borderColor: qrContrast === 'cyber' ? 'var(--neon-mint)' : undefined,
                      color: qrContrast === 'cyber' ? 'var(--neon-mint)' : undefined
                    }}
                    onClick={() => setQrContrast('cyber')}
                  >
                    Cyber Dark
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  className="input-field"
                  value={qrHost}
                  onChange={(e) => setQrHost(e.target.value)}
                  placeholder="Your IP (e.g. 10.10.65.21 or localhost)"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', flexShrink: 0 }}
                  onClick={() => setQrHost('10.10.65.21')}
                >
                  Use Wi-Fi IP
                </button>
              </div>
            </div>

            {/* Huge Room PIN Display */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem',
                marginBottom: '1.25rem'
              }}
            >
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                ROOM CODE PIN
              </span>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.75rem', fontWeight: 900, color: 'var(--neon-mint)', letterSpacing: '0.15em', textShadow: '0 0 20px rgba(0, 245, 160, 0.4)' }}>
                {qrModalSession.joinCode}
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn-secondary" onClick={() => copyCode(qrModalSession.joinCode)}>
                <Copy size={15} /> Copy PIN
              </button>

              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`crackvault-${qrModalSession.joinCode}.png`}
                  className="btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  <Download size={15} /> Save PNG
                </a>
              )}

              <button className="btn-primary" onClick={() => setQrModalSession(null)}>
                Close Display
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
