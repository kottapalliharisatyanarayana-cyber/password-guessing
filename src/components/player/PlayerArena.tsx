import React, { useState, useEffect } from 'react'
import { GameSession, Challenge, GamePlayer, AttemptLog } from '../../types'
import { HintVault } from './HintVault'
import { TerminalInput } from './TerminalInput'
import { LiveRoster } from './LiveRoster'
import { VictoryModal } from './VictoryModal'
import { calculateScore } from '../../lib/storage'
import { sound } from '../../lib/sound'
import { Shield, Clock, Award, Key, LogOut, Flame, Pause } from 'lucide-react'

interface PlayerArenaProps {
  session: GameSession
  challenge: Challenge
  player: GamePlayer
  players: GamePlayer[]
  onGuessAttempt: (isCorrect: boolean, guess: string, solveSeconds?: number) => void
  onRevealHint: (hintIndex: number) => void
  onLeaveGame: () => void
  onGoToLeaderboard: () => void
}

export const PlayerArena: React.FC<PlayerArenaProps> = ({
  session,
  challenge,
  player,
  players,
  onGuessAttempt,
  onRevealHint,
  onLeaveGame,
  onGoToLeaderboard
}) => {
  const [attempts, setAttempts] = useState<AttemptLog[]>([])
  const [revealedHints, setRevealedHints] = useState<number[]>(player.revealedHints || [])
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (session.status === 'playing' && session.startedAt) {
      return Math.max(0, session.totalSeconds - Math.floor((Date.now() - session.startedAt) / 1000))
    }
    return session.remainingSeconds ?? session.totalSeconds ?? 300
  })
  const [isWon, setIsWon] = useState<boolean>(player.status === 'solved')
  const [isLost, setIsLost] = useState<boolean>(player.status === 'failed')
  const [showVictoryModal, setShowVictoryModal] = useState<boolean>(false)

  // Keep remaining time synced when mission broadcast is paused by admin
  useEffect(() => {
    if (session.status === 'paused' && session.remainingSeconds !== undefined) {
      setSecondsRemaining(session.remainingSeconds)
    }
  }, [session.status, session.remainingSeconds])

  // Keep revealed hints synced with player prop
  useEffect(() => {
    if (player.revealedHints) {
      setRevealedHints(player.revealedHints)
    }
  }, [player.revealedHints])

  // Synchronized Room Mission Clock tick
  useEffect(() => {
    if (isWon || isLost || session.status !== 'playing') return

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          setIsLost(true)
          setShowVictoryModal(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isWon, isLost, session.status])

  // Synchronized Room Mission Elapsed Time
  const missionElapsedSeconds = Math.max(0, session.totalSeconds - secondsRemaining)

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(Math.max(0, secs) / 60)
    const s = Math.max(0, secs) % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Auto-reveal hints strictly based on mission elapsed countdown or admin broadcast force-unlock
  useEffect(() => {
    if (isWon || isLost || session.status !== 'playing') return

    const defaultInterval = challenge.hintIntervalSeconds || 45
    const toUnlock: number[] = []

    // Check clues 0 to 4
    for (let i = 0; i < 5; i++) {
      const hintContent = challenge.hintItems?.[i]?.content || challenge.hints[i]
      if (!hintContent?.trim()) continue

      const unlockAt = challenge.hintItems?.[i]?.unlockAfterSeconds ?? (i + 1) * defaultInterval
      const forceUnlocked = session.forceUnlockedHints?.includes(i)

      if ((missionElapsedSeconds >= unlockAt || forceUnlocked) && !revealedHints.includes(i)) {
        toUnlock.push(i)
      }
    }

    // Check optional visual clue (index 5)
    if (challenge.isImageClue && challenge.imageUrl?.trim()) {
      const visualUnlock = challenge.visualClueUnlockSeconds ?? Math.round(challenge.timeLimit * 0.85)
      const forceUnlocked = session.forceUnlockedHints?.includes(5)

      if ((missionElapsedSeconds >= visualUnlock || forceUnlocked) && !revealedHints.includes(5)) {
        toUnlock.push(5)
      }
    }

    if (toUnlock.length > 0) {
      sound.playHintUnlock()
      setRevealedHints((prev) => {
        const next = [...prev]
        toUnlock.forEach((idx) => {
          if (!next.includes(idx)) next.push(idx)
        })
        return next
      })
      toUnlock.forEach((idx) => onRevealHint(idx))
    }
  }, [missionElapsedSeconds, session.forceUnlockedHints, challenge, isWon, isLost, session.status, revealedHints, onRevealHint])

  // Handle Hint Reveal: 0 score deduction & 0 time penalty
  const handleReveal = (hintIndex: number) => {
    if (revealedHints.includes(hintIndex)) return

    sound.playHintUnlock()
    setRevealedHints((prev) => [...prev, hintIndex])
    onRevealHint(hintIndex)
  }

  // Handle Guess
  const handleGuess = (guess: string): boolean => {
    const target = challenge.password.trim()
    const input = guess.trim()
    const isCorrect = challenge.caseSensitive
      ? target === input
      : target.toUpperCase() === input.toUpperCase()

    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`

    const newLog: AttemptLog = {
      id: 'att_' + Date.now(),
      guess,
      isCorrect,
      timestamp: timeStr,
      feedback: isCorrect ? 'ACCESS GRANTED' : 'ACCESS DENIED'
    }

    const solveSecs = Math.max(1, missionElapsedSeconds)
    setAttempts((prev) => [...prev, newLog])
    onGuessAttempt(isCorrect, guess, solveSecs)

    if (isCorrect) {
      setIsWon(true)
      setShowVictoryModal(true)
    }

    return isCorrect
  }

  // Score Calculation: purely based on speed of completion and guess accuracy
  const currentScore = calculateScore(
    missionElapsedSeconds,
    session.totalSeconds,
    Math.max(1, attempts.length),
    revealedHints
  )

  // Paused status
  const isPaused = session.status === 'paused'

  // Timer Color logic
  const timerRatio = secondsRemaining / session.totalSeconds
  let timerClass = 'timer-green'
  if (isPaused) {
    timerClass = 'timer-amber'
  } else if (timerRatio < 0.2 || secondsRemaining <= 30) {
    timerClass = 'timer-crimson'
  } else if (timerRatio < 0.5) {
    timerClass = 'timer-amber'
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {/* Top Banner & Session HUD */}
      <div className="glass-panel player-hud" style={{ padding: '1.25rem 1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 245, 160, 0.1)',
              border: '1px solid var(--neon-mint)',
              color: 'var(--neon-mint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Key size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>{challenge.title}</h2>
              <span className={`badge ${challenge.difficulty === 'Insane' ? 'badge-crimson' : challenge.difficulty === 'Hard' ? 'badge-amber' : challenge.difficulty === 'Medium' ? 'badge-cyan' : 'badge-mint'}`}>
                {challenge.difficulty}
              </span>
              <span className="badge badge-violet">{challenge.category}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.85rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
              <span>Room PIN: <strong style={{ color: 'var(--neon-mint)', fontFamily: 'var(--font-mono)' }}>{session.joinCode}</strong></span>
              <span>•</span>
              <span>Agent: <strong style={{ color: '#fff' }}>{player.name}</strong> ({player.avatar})</span>
            </div>
          </div>
        </div>

        {/* Action / Leave */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={onLeaveGame} style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem' }}>
            <LogOut size={14} /> Leave Session
          </button>
        </div>
      </div>

      {/* Broadcast Paused Alert Banner */}
      {isPaused && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0.06) 100%)',
            border: '1px solid var(--neon-amber)',
            borderRadius: 'var(--radius-md)',
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.85rem',
            boxShadow: '0 0 24px rgba(245, 158, 11, 0.25)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.25)',
                border: '1px solid var(--neon-amber)',
                color: 'var(--neon-amber)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Pause size={18} />
            </div>
            <div>
              <strong style={{ color: '#fff', fontSize: '1.05rem', display: 'block' }}>
                MISSION BROADCAST PAUSED BY MISSION CONTROL
              </strong>
              <span style={{ fontSize: '0.82rem', color: 'var(--neon-amber)' }}>
                Mission timer frozen at {formatTime(secondsRemaining)} • Waiting for admin signal to resume...
              </span>
            </div>
          </div>
          <span className="badge badge-amber" style={{ padding: '0.35rem 0.75rem', fontSize: '0.72rem' }}>
            AWAITING HOST RESUME
          </span>
        </div>
      )}

      {/* Main Play Area Grid - Responsive */}
      <div className="player-arena-grid">
        {/* Left Column: Timer, Hints, and Terminal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Synchronized Cyber Countdown Timer */}
          <div className="timer-box player-timer-box">
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              REMAINING MISSION CLOCK
            </span>
            <div className={`timer-digits ${timerClass}`}>
              {formatTime(secondsRemaining)}
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginTop: '0.75rem', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, (secondsRemaining / session.totalSeconds) * 100))}%`,
                  background: isPaused ? 'var(--neon-amber)' : timerRatio < 0.2 ? 'var(--neon-crimson)' : timerRatio < 0.5 ? 'var(--neon-amber)' : 'var(--neon-mint)',
                  boxShadow: isPaused ? '0 0 12px rgba(245, 158, 11, 0.4)' : timerRatio < 0.2 ? 'var(--shadow-crimson)' : 'var(--shadow-glow)',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>
          </div>

          {/* Tactical Hint Vault */}
          <HintVault
            challenge={challenge}
            revealedHints={revealedHints}
            elapsedSeconds={missionElapsedSeconds}
            secondsRemaining={secondsRemaining}
            totalSeconds={session.totalSeconds}
            onRevealHint={handleReveal}
            disabled={isWon || isLost || isPaused}
          />

          {/* Answer Verification Input */}
          <TerminalInput
            onGuess={handleGuess}
            attempts={attempts}
            disabled={isWon || isLost || isPaused}
          />
        </div>

        {/* Right Column: Live Opponents Ticker & Score Projection */}
        <div>
          <LiveRoster
            players={players}
            currentPlayerId={player.id}
            currentScoreProjection={currentScore}
            totalSeconds={session.totalSeconds}
          />
        </div>
      </div>

      {/* Victory / Defeat Modal */}
      <VictoryModal
        isOpen={showVictoryModal}
        isWinner={isWon}
        winnerName={session.winnerName}
        score={player.score || currentScore}
        timeTaken={player.solveTime || missionElapsedSeconds}
        totalSeconds={session.totalSeconds}
        attempts={attempts.length}
        hintsUsed={revealedHints.length}
        revealedHints={revealedHints}
        onGoToLeaderboard={onGoToLeaderboard}
        onPlayAgain={onLeaveGame}
      />
    </div>
  )
}
