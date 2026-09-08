import React, { useState, useRef, useEffect } from 'react'
import { AttemptLog } from '../../types'
import { sound } from '../../lib/sound'
import { KeyRound, Send, ShieldAlert, CheckCircle, Clock, Lock, CheckCircle2 } from 'lucide-react'

interface TerminalInputProps {
  onGuess: (guess: string) => boolean
  attempts: AttemptLog[]
  disabled?: boolean
}

export const TerminalInput: React.FC<TerminalInputProps> = ({
  onGuess,
  attempts,
  disabled
}) => {
  const [inputVal, setInputVal] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus()
    }
  }, [disabled])

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [attempts])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inputVal.trim()
    if (!trimmed || disabled) return

    sound.playClick()
    const isCorrect = onGuess(trimmed)
    setInputVal('')

    if (isCorrect) {
      sound.playVictory()
      setFeedback('SUCCESS! PASSWORD VERIFIED — VAULT UNLOCKED')
    } else {
      sound.playError()
      setFeedback('INCORRECT PASSWORD — ATTEMPT LOGGED')
      setTimeout(() => setFeedback(null), 3000)
    }
  }

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      {/* Component Title Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
            <KeyRound size={18} style={{ color: 'var(--neon-mint)' }} />
            Answer Verification
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Enter and verify your password solution to unlock the vault.
          </p>
        </div>
        <span className="badge badge-amber" style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}>
          {attempts.length} {attempts.length === 1 ? 'Attempt' : 'Attempts'} Made
        </span>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Lock
              size={16}
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            />
            <input
              ref={inputRef}
              type="text"
              className="input-field"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={disabled ? 'Verification locked' : 'Enter target password...'}
              disabled={disabled}
              autoComplete="off"
              spellCheck="false"
              style={{
                paddingLeft: '2.5rem',
                paddingRight: '1rem',
                fontSize: '1rem',
                paddingTop: '0.75rem',
                paddingBottom: '0.75rem'
              }}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={disabled || !inputVal.trim()}
            style={{ padding: '0.75rem 1.5rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
          >
            <Send size={15} /> Verify Answer
          </button>
        </div>
      </form>

      {/* Live Feedback Alert Banner */}
      {feedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            background: feedback.includes('SUCCESS') ? 'rgba(0, 245, 160, 0.15)' : 'rgba(255, 51, 102, 0.15)',
            border: `1px solid ${feedback.includes('SUCCESS') ? 'var(--neon-mint)' : 'var(--neon-crimson)'}`,
            color: feedback.includes('SUCCESS') ? 'var(--neon-mint)' : 'var(--neon-crimson)',
            fontSize: '0.88rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            marginBottom: '1.25rem'
          }}
        >
          {feedback.includes('SUCCESS') ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
          {feedback}
        </div>
      )}

      {/* Attempt History List */}
      <div style={{ marginTop: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>
            Submission History
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {attempts.length} logged
          </span>
        </div>

        <div
          ref={logContainerRef}
          style={{
            background: 'rgba(6, 9, 16, 0.65)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            maxHeight: '180px',
            overflowY: 'auto',
            padding: '0.5rem'
          }}
        >
          {attempts.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1.5rem' }}>
              No guesses submitted yet. Type your answer above and click Verify Answer.
            </div>
          ) : (
            attempts.map((att, idx) => (
              <div
                key={att.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                  borderBottom: idx < attempts.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                  fontSize: '0.85rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', width: '22px' }}>#{idx + 1}</span>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{att.guess}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span
                    className={att.isCorrect ? 'badge badge-mint' : 'badge badge-crimson'}
                    style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}
                  >
                    {att.isCorrect ? 'CORRECT' : 'INCORRECT'}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={11} /> {att.timestamp}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
