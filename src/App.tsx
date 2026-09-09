import React, { useState, useEffect, useCallback } from 'react'
import {
  Challenge,
  GameSession,
  GamePlayer,
  ScoreEntry,
  AppSettings
} from './types'
import {
  storage,
  subscribeStateChange,
  calculateScore,
  initCloudSync,
  isCloudActive,
  deduplicatePlayersByName,
  DEFAULT_SETTINGS
} from './lib/storage'
import { supabaseBroadcastPlayerJoin, supabaseBroadcastPlayers } from './lib/supabase'
import { sound } from './lib/sound'
import { Navbar } from './components/Navbar'
import { PlayerLobby } from './components/player/PlayerLobby'
import { PlayerArena } from './components/player/PlayerArena'
import { AdminAuth } from './components/admin/AdminAuth'
import { AdminDashboard } from './components/admin/AdminDashboard'
import { CyberBackground } from './components/CyberBackground'
import { CheckCircle2, ShieldAlert } from 'lucide-react'

export function App() {
  // Global Data States
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [cloudConnected, setCloudConnected] = useState(isCloudActive())

  // Navigation & UI States
  const [currentMode, setCurrentMode] = useState<'player' | 'admin'>('player')
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [initialJoinCode, setInitialJoinCode] = useState<string>('')

  // Check URL query parameters for ?join= or ?room=
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('join') || params.get('room')
      if (code) {
        setInitialJoinCode(code.toUpperCase())
        setCurrentMode('player')
      }
    }
  }, [])

  // Player Active Session State
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null)

  // Toast Helper
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3200)
  }, [])

  // Load initial state from reactive storage
  const reloadData = useCallback(() => {
    setChallenges(storage.getChallenges())
    setSessions(storage.getSessions())
    setPlayers(storage.getPlayers())
    setScores(storage.getScores())
    const s = storage.getSettings()
    setSettings(s)
    sound.setEnabled(s.soundEnabled)
    setCloudConnected(isCloudActive())
  }, [])

  useEffect(() => {
    reloadData()

    // Cross-tab reactive listener
    const unsubscribeLocal = subscribeStateChange(() => {
      reloadData()
    })

    // Realtime Cloud listener across separate devices
    const unsubscribeCloud = initCloudSync(() => {
      reloadData()
    })

    return () => {
      unsubscribeLocal()
      unsubscribeCloud()
    }
  }, [reloadData])

  // Sound toggle
  const handleToggleSound = () => {
    const next = !settings.soundEnabled
    const updated = { ...settings, soundEnabled: next }
    setSettings(updated)
    storage.saveSettings(updated)
    sound.setEnabled(next)
    showToast(next ? 'Synthesizer Audio Enabled' : 'Audio Muted')
  }

  // --- PLAYER ACTIONS ---

  const handleJoinSession = (sessionCode: string, playerName: string, avatar: string) => {
    const cleanCode = sessionCode.trim().toUpperCase()
    const targetSession =
      sessions.find((s) => s.joinCode.toUpperCase() === cleanCode && s.status !== 'ended') ||
      sessions.find((s) => s.joinCode.toUpperCase() === cleanCode)
    if (!targetSession) return

    const cleanName = playerName.trim()

    // Find if player with the same name is already in this session
    const existing = players.find(
      (p) =>
        (p.sessionId === targetSession.id || (p.joinCode && p.joinCode.toUpperCase() === cleanCode)) &&
        p.name.toLowerCase().trim() === cleanName.toLowerCase()
    )

    let finalPlayerId: string
    let playerRecord: GamePlayer

    if (existing) {
      // Reconnect existing player without creating duplicate entries
      finalPlayerId = existing.id
      playerRecord = {
        ...existing,
        name: cleanName,
        sessionId: targetSession.id,
        joinCode: targetSession.joinCode,
        avatar: avatar || existing.avatar,
        status: targetSession.status === 'playing' ? 'playing' : existing.status
      }
    } else {
      // Register new player
      playerRecord = {
        id: 'p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        sessionId: targetSession.id,
        joinCode: targetSession.joinCode,
        name: cleanName,
        avatar,
        status: targetSession.status === 'playing' ? 'playing' : 'waiting',
        attempts: 0,
        hintsUsed: 0,
        revealedHints: [],
        joinedAt: new Date().toISOString()
      }
      finalPlayerId = playerRecord.id
    }

    // Filter out ANY previous entries with this name in this room, then append the single canonical record
    const filteredPlayers = players.filter(
      (p) =>
        !(
          (p.sessionId === targetSession.id || (p.joinCode && p.joinCode.toUpperCase() === cleanCode)) &&
          p.name.toLowerCase().trim() === cleanName.toLowerCase()
        )
    )
    const updatedPlayers = [...filteredPlayers, playerRecord]

    setPlayers(updatedPlayers)
    storage.savePlayers(updatedPlayers)
    supabaseBroadcastPlayerJoin(playerRecord)
    supabaseBroadcastPlayers(updatedPlayers)

    setActiveSessionId(targetSession.id)
    setCurrentPlayerId(finalPlayerId)
    showToast(`Joined session: ${targetSession.joinCode}`)
  }

  const handlePlayerGuessAttempt = (isCorrect: boolean, guess: string) => {
    if (!currentPlayerId || !activeSessionId) return

    const currentSession = sessions.find((s) => s.id === activeSessionId)
    const currentChallenge = challenges.find((c) => c.id === currentSession?.challengeId)
    const activePlayer = players.find((p) => p.id === currentPlayerId)
    if (!currentSession || !currentChallenge || !activePlayer) return

    const newAttempts = activePlayer.attempts + 1
    const hintsCount = activePlayer.revealedHints.length

    if (isCorrect) {
      const finalScore = calculateScore(0, newAttempts, activePlayer.revealedHints)

      // Update Player
      const updatedPlayers = players.map((p) => {
        if (p.id === currentPlayerId) {
          return { ...p, attempts: newAttempts, status: 'solved' as const, score: finalScore }
        }
        if (p.sessionId === activeSessionId || (currentSession && p.joinCode === currentSession.joinCode)) {
          return { ...p, status: 'failed' as const }
        }
        return p
      })
      setPlayers(updatedPlayers)
      storage.savePlayers(updatedPlayers)

      // End Session
      const updatedSessions = sessions.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              status: 'ended' as const,
              winnerName: activePlayer.name,
              winnerScore: finalScore
            }
          : s
      )
      setSessions(updatedSessions)
      storage.saveSessions(updatedSessions)

      // Add to Global Leaderboard
      const newScore = storage.addScore({
        challengeTitle: currentChallenge.title,
        playerName: activePlayer.name,
        score: finalScore,
        timeTaken: 0,
        attempts: newAttempts,
        hintsRevealed: hintsCount
      })
      setScores((prev) => [newScore, ...prev])
      showToast(`🏆 VAULT BREACHED! Score: ${finalScore.toLocaleString()} pts`)
    } else {
      // Failed attempt
      const updatedPlayers = players.map((p) =>
        p.id === currentPlayerId ? { ...p, attempts: newAttempts } : p
      )
      setPlayers(updatedPlayers)
      storage.savePlayers(updatedPlayers)
    }
  }

  const handlePlayerRevealHint = (hintIndex: number) => {
    if (!currentPlayerId) return

    const updatedPlayers = players.map((p) => {
      if (p.id === currentPlayerId) {
        const revealed = [...p.revealedHints, hintIndex]
        return {
          ...p,
          revealedHints: revealed,
          hintsUsed: revealed.length
        }
      }
      return p
    })
    setPlayers(updatedPlayers)
    storage.savePlayers(updatedPlayers)
  }

  const handleLeaveGame = () => {
    setActiveSessionId(null)
    setCurrentPlayerId(null)
    showToast('Exited session to lobby')
  }

  // --- ADMIN ACTIONS ---

  const handleCreateSession = (challengeId: string, customTime?: number) => {
    const ch = challenges.find((c) => c.id === challengeId)
    if (!ch) return

    // Generate random 6-character uppercase PIN
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    const duration = customTime || ch.timeLimit || settings.defaultTimeLimit

    const newSession: GameSession = {
      id: 'sess_' + Date.now(),
      challengeId,
      challenge: ch,
      joinCode: code,
      status: 'lobby',
      totalSeconds: duration,
      remainingSeconds: duration,
      createdAt: new Date().toISOString()
    }

    const updated = [newSession, ...sessions]
    setSessions(updated)
    storage.saveSessions(updated)
    storage.saveChallenges(challenges)
    showToast(`Room ${code} launched in Lobby mode`)
  }

  const handleStartSession = (sessionId: string) => {
    const updated = sessions.map((s) =>
      s.id === sessionId ? { ...s, status: 'playing' as const, startedAt: Date.now() } : s
    )
    setSessions(updated)
    storage.saveSessions(updated)

    // Move waiting players to playing
    const updatedPlayers = players.map((p) =>
      p.sessionId === sessionId ? { ...p, status: 'playing' as const } : p
    )
    setPlayers(updatedPlayers)
    storage.savePlayers(updatedPlayers)

    showToast('Session Started! Players moved into the arena.')
  }

  const handlePauseSession = (sessionId: string) => {
    const updated = sessions.map((s) =>
      s.id === sessionId ? { ...s, status: 'lobby' as const } : s
    )
    setSessions(updated)
    storage.saveSessions(updated)
    showToast('Session paused')
  }

  const handleResumeSession = (sessionId: string) => {
    const updated = sessions.map((s) =>
      s.id === sessionId ? { ...s, status: 'playing' as const } : s
    )
    setSessions(updated)
    storage.saveSessions(updated)
    showToast('Session resumed')
  }

  const handleResetSession = (sessionId: string) => {
    const sTarget = sessions.find((s) => s.id === sessionId)
    if (!sTarget) return

    const updated = sessions.map((s) =>
      s.id === sessionId
        ? {
            ...s,
            status: 'lobby' as const,
            remainingSeconds: s.totalSeconds,
            winnerName: undefined,
            winnerScore: undefined,
            forceUnlockedHints: []
          }
        : s
    )
    setSessions(updated)
    storage.saveSessions(updated)

    // Reset players for this session
    const updatedPlayers = players.filter(
      (p) =>
        p.sessionId !== sessionId &&
        (!p.joinCode || p.joinCode.toUpperCase() !== sTarget.joinCode.toUpperCase())
    )
    setPlayers(updatedPlayers)
    storage.savePlayers(updatedPlayers)
    showToast('Session re-opened in lobby mode')
  }

  const handleForceRevealNextHint = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) return
    const ch = challenges.find((c) => c.id === session.challengeId)
    if (!ch) return

    const forceUnlocked = session.forceUnlockedHints || []
    let nextIdx: number | null = null
    for (let i = 0; i < 5; i++) {
      const content = ch.hintItems?.[i]?.content || ch.hints[i]
      if (content?.trim() && !forceUnlocked.includes(i)) {
        nextIdx = i
        break
      }
    }
    if (nextIdx === null && ch.isImageClue && ch.imageUrl?.trim() && !forceUnlocked.includes(5)) {
      nextIdx = 5
    }

    if (nextIdx === null) {
      showToast('All clues for this mission have already been unlocked!')
      return
    }

    const updatedForce = [...forceUnlocked, nextIdx]
    const updatedSessions = sessions.map((s) =>
      s.id === sessionId ? { ...s, forceUnlockedHints: updatedForce } : s
    )
    setSessions(updatedSessions)
    storage.saveSessions(updatedSessions)
    sound.playHintUnlock()
    showToast(`⚡ Admin broadcast: ${nextIdx === 5 ? 'Visual Dossier' : `Clue #${nextIdx + 1}`} revealed to all contestants!`)
  }

  const handleDeleteSession = (sessionId: string) => {
    const sTarget = sessions.find((s) => s.id === sessionId)
    const updated = sessions.filter((s) => s.id !== sessionId)
    setSessions(updated)
    storage.saveSessions(updated)

    const updatedPlayers = players.filter(
      (p) =>
        p.sessionId !== sessionId &&
        (!sTarget || !p.joinCode || p.joinCode.toUpperCase() !== sTarget.joinCode.toUpperCase())
    )
    setPlayers(updatedPlayers)
    storage.savePlayers(updatedPlayers)
    showToast('Session deleted')
  }

  const handleSaveChallenge = (ch: Challenge) => {
    const exists = challenges.some((c) => c.id === ch.id)
    const updated = exists ? challenges.map((c) => (c.id === ch.id ? ch : c)) : [ch, ...challenges]
    setChallenges(updated)
    storage.saveChallenges(updated)
  }

  const handleDeleteChallenge = (id: string) => {
    const updated = challenges.filter((c) => c.id !== id)
    setChallenges(updated)
    storage.saveChallenges(updated)
  }

  const handleClearLeaderboard = () => {
    setScores([])
    storage.saveScores([])
  }

  const handleUpdateSettings = (s: AppSettings) => {
    setSettings(s)
    storage.saveSettings(s)
  }

  const handleResetAll = () => {
    storage.resetAll()
    reloadData()
    setActiveSessionId(null)
    setCurrentPlayerId(null)
    showToast('All system data reset to defaults')
  }

  // Simulate Bot Competitor
  const handleSimulateBot = (sessionId: string) => {
    const botNames = ['CyberGhost', 'Phreak-00', 'Glitch_Byte', 'Vektor_7', 'Echo-Prime']
    const avatars = ['🤖', '👾', '🦊', '⚡', '🛸']
    const randName = botNames[Math.floor(Math.random() * botNames.length)] + '_' + Math.floor(Math.random() * 99)
    const randAvatar = avatars[Math.floor(Math.random() * avatars.length)]

    const newBotPlayer: GamePlayer = {
      id: 'bot_' + Date.now(),
      sessionId,
      name: randName,
      avatar: randAvatar,
      status: 'playing',
      attempts: Math.floor(Math.random() * 3) + 1,
      hintsUsed: Math.floor(Math.random() * 2),
      revealedHints: [0],
      joinedAt: new Date().toISOString()
    }

    const updated = [...players, newBotPlayer]
    setPlayers(updated)
    storage.savePlayers(updated)
    sound.playClick()
    showToast(`Bot contestant "${randName}" simulated in room!`)
  }

  // Contestant Roster Admin Handlers
  const handleRemovePlayer = (playerId: string) => {
    const updated = players.filter((p) => p.id !== playerId)
    setPlayers(updated)
    storage.savePlayers(updated)
    showToast('Contestant removed from room')
  }

  const handleClearSessionPlayers = (sessionId: string) => {
    const sTarget = sessions.find((s) => s.id === sessionId)
    const updated = players.filter(
      (p) =>
        p.sessionId !== sessionId &&
        (!sTarget || !p.joinCode || p.joinCode.toUpperCase() !== sTarget.joinCode.toUpperCase())
    )
    setPlayers(updated)
    storage.savePlayers(updated)
    showToast('Room roster cleared')
  }

  // Active Session & Player details
  const currentSession = sessions.find((s) => s.id === activeSessionId)
  const currentChallenge = currentSession?.challenge || challenges.find((c) => c.id === currentSession?.challengeId)
  const currentPlayer = players.find((p) => p.id === currentPlayerId)
  const rawSessionPlayers = players.filter(
    (p) =>
      p.sessionId === activeSessionId ||
      (currentSession && p.joinCode && p.joinCode.toUpperCase() === currentSession.joinCode.toUpperCase())
  )
  const currentSessionPlayers = deduplicatePlayersByName(rawSessionPlayers)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Animated Cyber Ambient Background & Particles */}
      <CyberBackground />

      {/* Top Navigation */}
      <Navbar
        currentMode={currentMode}
        onSelectMode={(mode) => {
          setCurrentMode(mode)
          if (mode === 'admin' && !isAdminLoggedIn) {
            // will show login screen
          }
        }}
        soundEnabled={settings.soundEnabled}
        onToggleSound={handleToggleSound}
        activeSessionCount={sessions.filter((s) => s.status === 'playing').length}
        cloudConnected={cloudConnected}
      />

      {/* Main Content Area */}
      <main className="main-wrapper">
        {currentMode === 'player' ? (
          activeSessionId && currentSession && currentChallenge && currentPlayer ? (
            currentSession.status === 'lobby' ? (
              <PlayerLobby
                sessions={sessions}
                challenges={challenges}
                players={players}
                onJoinSession={handleJoinSession}
                currentWaitingSession={currentSession}
                currentWaitingPlayer={currentPlayer}
                onLeaveWaiting={handleLeaveGame}
              />
            ) : (
              <PlayerArena
                session={currentSession}
                challenge={currentChallenge}
                player={currentPlayer}
                players={currentSessionPlayers}
                onGuessAttempt={handlePlayerGuessAttempt}
                onRevealHint={handlePlayerRevealHint}
                onLeaveGame={handleLeaveGame}
                onGoToLeaderboard={() => {
                  handleLeaveGame()
                  setCurrentMode('admin')
                  setIsAdminLoggedIn(true)
                }}
              />
            )
          ) : (
            <PlayerLobby
              sessions={sessions}
              challenges={challenges}
              players={players}
              onJoinSession={handleJoinSession}
              initialCode={initialJoinCode}
            />
          )
        ) : !isAdminLoggedIn ? (
          <AdminAuth
            onSuccess={() => {
              setIsAdminLoggedIn(true)
              showToast('Admin login verified')
            }}
            adminUsername={settings.adminUsername || 'admin'}
            adminPasswordHash={settings.adminPassword || 'admin123'}
          />
        ) : (
          <AdminDashboard
            challenges={challenges}
            sessions={sessions}
            players={players}
            scores={scores}
            settings={settings}
            onStartSession={handleStartSession}
            onPauseSession={handlePauseSession}
            onResumeSession={handleResumeSession}
            onResetSession={handleResetSession}
            onDeleteSession={handleDeleteSession}
            onCreateSession={handleCreateSession}
            onSaveChallenge={handleSaveChallenge}
            onDeleteChallenge={handleDeleteChallenge}
            onClearLeaderboard={handleClearLeaderboard}
            onUpdateSettings={handleUpdateSettings}
            onResetAll={handleResetAll}
            onSimulateBot={handleSimulateBot}
            onLogout={() => {
              setIsAdminLoggedIn(false)
              showToast('Logged out of Admin Command')
            }}
            onNotify={showToast}
            onForceRevealNextHint={handleForceRevealNextHint}
            onRemovePlayer={handleRemovePlayer}
            onClearSessionPlayers={handleClearSessionPlayers}
          />
        )}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="toast-container">
          <CheckCircle2 size={16} style={{ color: 'var(--neon-mint)' }} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  )
}
export default App
