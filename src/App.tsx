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
import {
  apiSavePlayer,
  apiSaveSession,
  apiUpdateSession,
  apiDeleteSession,
  apiSaveChallenge,
  apiDeleteChallenge,
  apiDeletePlayer,
  apiClearSessionPlayers,
  apiClearScores,
  apiSaveSettings,
  apiResetAll
} from './lib/api'
import { sound } from './lib/sound'
import { PlayerPage } from './pages/PlayerPage'
import { AdminPage } from './pages/AdminPage'
import { CyberBackground } from './components/CyberBackground'
import { CheckCircle2 } from 'lucide-react'

export function App() {
  // Global Data States
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [scores, setScores] = useState<ScoreEntry[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [cloudConnected, setCloudConnected] = useState(isCloudActive())

  // Dedicated Route Detection: /admin vs / (Player)
  const getIsAdminPath = () => {
    if (typeof window === 'undefined') return false
    const path = window.location.pathname.toLowerCase()
    const hash = window.location.hash.toLowerCase()
    const params = new URLSearchParams(window.location.search)
    return (
      path.startsWith('/admin') ||
      hash === '#admin' ||
      hash.startsWith('#/admin') ||
      params.get('mode') === 'admin' ||
      params.get('admin') === 'true'
    )
  }

  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(getIsAdminPath)
  const [toast, setToast] = useState<string | null>(null)
  const [initialJoinCode, setInitialJoinCode] = useState<string>('')

  // Route & Query Params Initializer
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('join') || params.get('room')
      if (code) {
        setInitialJoinCode(code.toUpperCase())
        setIsAdminRoute(false)
      } else {
        setIsAdminRoute(getIsAdminPath())
      }

      const handleLocationChange = () => {
        setIsAdminRoute(getIsAdminPath())
      }
      window.addEventListener('popstate', handleLocationChange)
      window.addEventListener('hashchange', handleLocationChange)
      return () => {
        window.removeEventListener('popstate', handleLocationChange)
        window.removeEventListener('hashchange', handleLocationChange)
      }
    }
  }, [])

  // Navigation Handlers
  const navigateToAdmin = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/admin')
    }
    setIsAdminRoute(true)
    sound.playClick()
  }

  const navigateToPlayer = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/')
    }
    setIsAdminRoute(false)
    sound.playClick()
  }

  // Player Active Session State (persisted to sessionStorage for resilient page reloads)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('crackvault_active_session_id')
    }
    return null
  })
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(() => {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('crackvault_current_player_id')
    }
    return null
  })
  const [joinedPlayer, setJoinedPlayer] = useState<GamePlayer | null>(null)

  // Toast Helper
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3200)
  }, [])

  // Load initial state from reactive storage
  const reloadData = useCallback(() => {
    const loadedChallenges = storage.getChallenges()
    let loadedSessions = storage.getSessions()

    // Automatically prune any orphan sessions whose challenge was deleted
    if (loadedChallenges.length > 0) {
      const validSessions = loadedSessions.filter(
        (s) => s.challenge || loadedChallenges.some((c) => c.id === s.challengeId)
      )
      if (validSessions.length !== loadedSessions.length) {
        loadedSessions = validSessions
        storage.saveSessions(validSessions)
      }
    }

    setChallenges(loadedChallenges)
    setSessions(loadedSessions)
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

    // Realtime Cloud listener across separate devices via Express & MongoDB Atlas
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
    apiSavePlayer(playerRecord).catch(() => {})

    setActiveSessionId(targetSession.id)
    setCurrentPlayerId(finalPlayerId)
    setJoinedPlayer(playerRecord)

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('crackvault_active_session_id', targetSession.id)
      sessionStorage.setItem('crackvault_current_player_id', finalPlayerId)
    }

    showToast(`Joined session: ${targetSession.joinCode}`)
  }

  const handlePlayerGuessAttempt = (isCorrect: boolean, guess: string, solveSeconds?: number) => {
    if (!activeSessionId) return

    const activeChallenge = currentChallenge || currentSession?.challenge || challenges.find((c) => c.id === currentSession?.challengeId)
    const activePlayer = currentPlayer || players.find((p) => p.id === currentPlayerId)
    if (!currentSession || !activeChallenge || !activePlayer) return

    const newAttempts = activePlayer.attempts + 1
    const hintsCount = activePlayer.revealedHints.length

    if (isCorrect) {
      const solveTime = solveSeconds !== undefined && solveSeconds > 0
        ? solveSeconds
        : Math.max(1, currentSession.totalSeconds - (currentSession.remainingSeconds || 0))
      const finalScore = calculateScore(solveTime, currentSession.totalSeconds, newAttempts, activePlayer.revealedHints)

      // Update Player with solveTime and score
      const updatedPlayers = players.map((p) => {
        if (p.id === activePlayer.id) {
          return { ...p, attempts: newAttempts, status: 'solved' as const, score: finalScore, solveTime }
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
        challengeTitle: activeChallenge.title,
        playerName: activePlayer.name,
        score: finalScore,
        timeTaken: solveTime,
        attempts: newAttempts,
        hintsRevealed: hintsCount
      })
      setScores((prev) => [newScore, ...prev])
      showToast(`🏆 VAULT BREACHED in ${solveTime}s! Score: ${finalScore.toLocaleString()} pts`)
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
    setJoinedPlayer(null)
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('crackvault_active_session_id')
      sessionStorage.removeItem('crackvault_current_player_id')
    }
    showToast('Exited session to lobby')
  }

  // --- ADMIN ACTIONS ---

  const handleCreateSession = (challengeId: string, customTime?: number) => {
    const ch = challenges.find((c) => c.id === challengeId)
    if (!ch) return

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
    apiSaveSession(newSession).catch(() => {})
    showToast(`Room ${code} launched in Lobby mode`)
  }

  const handleStartSession = (sessionId: string) => {
    const updated = sessions.map((s) =>
      s.id === sessionId ? { ...s, status: 'playing' as const, startedAt: Date.now() } : s
    )
    setSessions(updated)
    storage.saveSessions(updated)

    const updatedPlayers = players.map((p) =>
      p.sessionId === sessionId ? { ...p, status: 'playing' as const } : p
    )
    setPlayers(updatedPlayers)
    storage.savePlayers(updatedPlayers)
    apiUpdateSession(sessionId, { status: 'playing', startedAt: Date.now() }).catch(() => {})

    showToast('Session Started! Contestants moved into the arena.')
  }

  const handlePauseSession = (sessionId: string) => {
    const updated = sessions.map((s) =>
      s.id === sessionId ? { ...s, status: 'paused' as const } : s
    )
    setSessions(updated)
    storage.saveSessions(updated)
    apiUpdateSession(sessionId, { status: 'paused' }).catch(() => {})
    showToast('Mission broadcast paused — all contestant clocks frozen')
  }

  const handleResumeSession = (sessionId: string) => {
    const updated = sessions.map((s) =>
      s.id === sessionId ? { ...s, status: 'playing' as const } : s
    )
    setSessions(updated)
    storage.saveSessions(updated)
    apiUpdateSession(sessionId, { status: 'playing' }).catch(() => {})
    showToast('Mission broadcast resumed!')
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

    const updatedPlayers = players.map((p) =>
      p.sessionId === sessionId || (p.joinCode && sTarget.joinCode && p.joinCode.toUpperCase() === sTarget.joinCode.toUpperCase())
        ? { ...p, status: 'waiting' as const, attempts: 0, hintsUsed: 0, revealedHints: [], score: undefined }
        : p
    )
    setPlayers(updatedPlayers)
    storage.savePlayers(updatedPlayers)
    apiUpdateSession(sessionId, {
      status: 'lobby',
      remainingSeconds: sTarget.totalSeconds,
      winnerName: undefined,
      winnerScore: undefined,
      forceUnlockedHints: []
    }).catch(() => {})
    showToast('Broadcast stopped — contestants returned to waiting lobby')
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
    apiUpdateSession(sessionId, { forceUnlockedHints: updatedForce }).catch(() => {})
    sound.playHintUnlock()
    showToast(`⚡ Admin broadcast: ${nextIdx === 5 ? 'Visual Dossier' : `Clue #${nextIdx + 1}`} revealed to all contestants!`)
  }

  const handleDeleteSession = (sessionId: string) => {
    const sTarget = sessions.find((s) => s.id === sessionId)
    const updated = sessions.filter((s) => s.id !== sessionId)
    setSessions(updated)
    storage.saveSessions(updated)
    apiDeleteSession(sessionId).catch(() => {})

    const updatedPlayers = players.filter(
      (p) =>
        p.sessionId !== sessionId &&
        (!sTarget || !p.joinCode || p.joinCode.toUpperCase() !== sTarget.joinCode.toUpperCase())
    )
    setPlayers(updatedPlayers)
    storage.savePlayers(updatedPlayers)
    showToast('Session deleted')
  }

  const handleSaveChallenge = async (ch: Challenge) => {
    const exists = challenges.some((c) => c.id === ch.id)
    const updated = exists ? challenges.map((c) => (c.id === ch.id ? ch : c)) : [ch, ...challenges]
    setChallenges(updated)
    storage.saveChallenges(updated)
    const res = await apiSaveChallenge(ch)
    if (res) {
      showToast('Challenge saved to MongoDB Atlas!')
    } else {
      showToast('Challenge saved locally')
    }
  }

  const handleDeleteChallenge = (id: string) => {
    const updated = challenges.filter((c) => c.id !== id)
    setChallenges(updated)
    storage.saveChallenges(updated)
    apiDeleteChallenge(id).catch(() => {})

    // Also remove any sessions associated with this deleted challenge
    const orphanedSessions = sessions.filter((s) => s.challengeId === id)
    orphanedSessions.forEach((s) => apiDeleteSession(s.id).catch(() => {}))
    const updatedSessions = sessions.filter((s) => s.challengeId !== id)
    setSessions(updatedSessions)
    storage.saveSessions(updatedSessions)
  }

  const handleClearLeaderboard = () => {
    setScores([])
    storage.saveScores([])
    apiClearScores().catch(() => {})
  }

  const handleUpdateSettings = (s: AppSettings) => {
    setSettings(s)
    storage.saveSettings(s)
    apiSaveSettings(s).catch(() => {})
  }

  const handleResetAll = () => {
    storage.resetAll()
    apiResetAll().catch(() => {})
    reloadData()
    setActiveSessionId(null)
    setCurrentPlayerId(null)
    showToast('All system data reset to defaults')
  }

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
    apiSavePlayer(newBotPlayer).catch(() => {})
    sound.playClick()
    showToast(`Bot competitor "${randName}" simulated in room!`)
  }

  const handleRemovePlayer = (playerId: string) => {
    const updated = players.filter((p) => p.id !== playerId)
    setPlayers(updated)
    storage.savePlayers(updated)
    apiDeletePlayer(playerId).catch(() => {})
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
    apiClearSessionPlayers(sessionId).catch(() => {})
    showToast('Room roster cleared')
  }

  // Active Session & Resilient Details
  const currentSession = sessions.find((s) => s.id === activeSessionId)

  const currentChallenge: Challenge | undefined = (() => {
    if (!currentSession) return undefined
    if (currentSession.challenge) return currentSession.challenge
    const ch = challenges.find((c) => c.id === currentSession.challengeId)
    if (ch) return ch

    const fallback: Challenge = {
      id: currentSession.challengeId || 'ch_' + currentSession.id,
      title: 'Decryption Protocol',
      category: 'Cyber Vault Mission',
      password: 'VAULT',
      hints: [
        'Security breach detected in local subnet.',
        'Decryption sequence initialized.',
        'Target access key encrypted with standard cipher.',
        'Cipher text matches algorithmic pattern.',
        'Final protocol override ready for input.'
      ],
      timeLimit: currentSession.totalSeconds || 300,
      difficulty: 'Medium',
      isActive: true,
      createdAt: currentSession.createdAt
    }
    return fallback
  })()

  const currentPlayer =
    players.find((p) => p.id === currentPlayerId) ||
    joinedPlayer ||
    (currentSession && currentPlayerId
      ? players.find(
          (p) =>
            p.sessionId === currentSession.id ||
            (p.joinCode && p.joinCode.toUpperCase() === currentSession.joinCode.toUpperCase())
        )
      : undefined)

  const rawSessionPlayers = players.filter(
    (p) =>
      p.sessionId === activeSessionId ||
      (currentSession && p.joinCode && p.joinCode.toUpperCase() === currentSession.joinCode.toUpperCase())
  )
  const currentSessionPlayers = deduplicatePlayersByName(rawSessionPlayers)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Animated Cyber Background */}
      <CyberBackground />

      {/* DEDICATED SEPARATE PAGES */}
      {isAdminRoute ? (
        <AdminPage
          challenges={challenges}
          sessions={sessions}
          players={players}
          scores={scores}
          settings={settings}
          cloudConnected={cloudConnected}
          soundEnabled={settings.soundEnabled}
          onToggleSound={handleToggleSound}
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
          onForceRevealNextHint={handleForceRevealNextHint}
          onRemovePlayer={handleRemovePlayer}
          onClearSessionPlayers={handleClearSessionPlayers}
          onNavigateToPlayer={navigateToPlayer}
          onNotify={showToast}
        />
      ) : (
        <PlayerPage
          sessions={sessions}
          challenges={challenges}
          players={players}
          activeSessionId={activeSessionId}
          currentSession={currentSession}
          currentChallenge={currentChallenge}
          currentPlayer={currentPlayer}
          currentSessionPlayers={currentSessionPlayers}
          initialJoinCode={initialJoinCode}
          cloudConnected={cloudConnected}
          soundEnabled={settings.soundEnabled}
          onToggleSound={handleToggleSound}
          onJoinSession={handleJoinSession}
          onPlayerGuessAttempt={handlePlayerGuessAttempt}
          onPlayerRevealHint={handlePlayerRevealHint}
          onLeaveGame={handleLeaveGame}
          onNavigateToAdmin={navigateToAdmin}
        />
      )}

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

