import React, { useState } from 'react'
import { Challenge, GameSession, GamePlayer, ScoreEntry, AppSettings } from '../../types'
import { SessionManager } from './SessionManager'
import { ChallengeCrud } from './ChallengeCrud'
import { LeaderboardView } from './LeaderboardView'
import { SettingsView } from './SettingsView'
import { sound } from '../../lib/sound'
import {
  Radio,
  KeyRound,
  Trophy,
  Settings,
  LogOut,
  Users,
  ShieldAlert,
  Sparkles
} from 'lucide-react'

interface AdminDashboardProps {
  challenges: Challenge[]
  sessions: GameSession[]
  players: GamePlayer[]
  scores: ScoreEntry[]
  settings: AppSettings
  onStartSession: (id: string) => void
  onPauseSession: (id: string) => void
  onResumeSession: (id: string) => void
  onResetSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onCreateSession: (challengeId: string, customTime?: number) => void
  onSaveChallenge: (challenge: Challenge) => Promise<void> | void
  onDeleteChallenge: (id: string) => void
  onClearLeaderboard: () => void
  onUpdateSettings: (settings: AppSettings) => void
  onResetAll: () => void
  onSimulateBot: (sessionId: string) => void
  onLogout: () => void
  onNotify: (msg: string) => void
  onForceRevealNextHint?: (sessionId: string) => void
  onRemovePlayer?: (playerId: string) => void
  onClearSessionPlayers?: (sessionId: string) => void
}

type AdminTab = 'sessions' | 'challenges' | 'leaderboard' | 'settings'

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  challenges,
  sessions,
  players,
  scores,
  settings,
  onStartSession,
  onPauseSession,
  onResumeSession,
  onResetSession,
  onDeleteSession,
  onCreateSession,
  onSaveChallenge,
  onDeleteChallenge,
  onClearLeaderboard,
  onUpdateSettings,
  onResetAll,
  onSimulateBot,
  onLogout,
  onNotify,
  onForceRevealNextHint,
  onRemovePlayer,
  onClearSessionPlayers
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('sessions')

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab)
    sound.playClick()
  }

  // Aggregate metrics (unique agents by lowercase name)
  const activeSessionsCount = sessions.filter((s) => s.status === 'playing').length
  const totalPlayersCount = new Set(players.map((p) => p.name.trim().toLowerCase())).size
  const totalSolvesCount = scores.length

  return (
    <div>
      {/* Admin Subheader with Tabs and Stats */}
      <div className="glass-panel" style={{ padding: '1rem 1.75rem', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className={`btn-secondary ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => handleTabChange('sessions')}
            style={{
              borderColor: activeTab === 'sessions' ? 'var(--neon-mint)' : undefined,
              color: activeTab === 'sessions' ? 'var(--neon-mint)' : undefined,
              background: activeTab === 'sessions' ? 'rgba(0, 245, 160, 0.1)' : undefined
            }}
          >
            <Radio size={15} />
            <span>Mission Control</span>
            {activeSessionsCount > 0 && <span className="pulse-dot" style={{ width: '6px', height: '6px' }} />}
          </button>

          <button
            className={`btn-secondary ${activeTab === 'challenges' ? 'active' : ''}`}
            onClick={() => handleTabChange('challenges')}
            style={{
              borderColor: activeTab === 'challenges' ? 'var(--neon-cyan)' : undefined,
              color: activeTab === 'challenges' ? 'var(--neon-cyan)' : undefined,
              background: activeTab === 'challenges' ? 'rgba(0, 216, 246, 0.1)' : undefined
            }}
          >
            <KeyRound size={15} />
            <span>Challenge Workshop ({challenges.length})</span>
          </button>

          <button
            className={`btn-secondary ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => handleTabChange('leaderboard')}
            style={{
              borderColor: activeTab === 'leaderboard' ? 'var(--neon-amber)' : undefined,
              color: activeTab === 'leaderboard' ? 'var(--neon-amber)' : undefined,
              background: activeTab === 'leaderboard' ? 'rgba(245, 158, 11, 0.1)' : undefined
            }}
          >
            <Trophy size={15} />
            <span>Leaderboard</span>
          </button>

          <button
            className={`btn-secondary ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabChange('settings')}
            style={{
              borderColor: activeTab === 'settings' ? '#cbd5e1' : undefined,
              color: activeTab === 'settings' ? '#fff' : undefined
            }}
          >
            <Settings size={15} />
            <span>Settings</span>
          </button>
        </div>

        {/* Quick Stats Pill & Exit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>
              Rooms Live: <strong style={{ color: 'var(--neon-mint)' }}>{activeSessionsCount}</strong>
            </span>
            <span>•</span>
            <span>
              Active Agents: <strong style={{ color: 'var(--neon-cyan)' }}>{totalPlayersCount}</strong>
            </span>
            <span>•</span>
            <span>
              Vault Solves: <strong style={{ color: 'var(--neon-amber)' }}>{totalSolvesCount}</strong>
            </span>
          </div>

          <button
            className="btn-icon"
            onClick={onLogout}
            title="Exit to Player Arena"
            style={{ color: 'var(--neon-cyan)' }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'sessions' && (
        <SessionManager
          sessions={sessions}
          challenges={challenges}
          players={players}
          onStartSession={onStartSession}
          onPauseSession={onPauseSession}
          onResumeSession={onResumeSession}
          onResetSession={onResetSession}
          onDeleteSession={onDeleteSession}
          onCreateSession={onCreateSession}
          onSimulateBot={onSimulateBot}
          onNotify={onNotify}
          onForceRevealNextHint={onForceRevealNextHint}
          onGoToChallenges={() => setActiveTab('challenges')}
          onRemovePlayer={onRemovePlayer}
          onClearSessionPlayers={onClearSessionPlayers}
        />
      )}

      {activeTab === 'challenges' && (
        <ChallengeCrud
          challenges={challenges}
          onSaveChallenge={onSaveChallenge}
          onDeleteChallenge={onDeleteChallenge}
          onNotify={onNotify}
          onLaunchSession={(challengeId) => {
            onCreateSession(challengeId)
            setActiveTab('sessions')
          }}
        />
      )}

      {activeTab === 'leaderboard' && (
        <LeaderboardView
          scores={scores}
          onClearLeaderboard={onClearLeaderboard}
          onNotify={onNotify}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsView
          settings={settings}
          onUpdateSettings={onUpdateSettings}
          onResetAll={onResetAll}
          onNotify={onNotify}
        />
      )}
    </div>
  )
}
