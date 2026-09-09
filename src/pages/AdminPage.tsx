import React, { useState } from 'react'
import { Challenge, GameSession, GamePlayer, ScoreEntry, AppSettings } from '../types'
import { AdminAuth } from '../components/admin/AdminAuth'
import { AdminDashboard } from '../components/admin/AdminDashboard'
import { Shield, Volume2, VolumeX, LogOut, ArrowLeft, Users, Database } from 'lucide-react'
import { sound } from '../lib/sound'

interface AdminPageProps {
  challenges: Challenge[]
  sessions: GameSession[]
  players: GamePlayer[]
  scores: ScoreEntry[]
  settings: AppSettings
  cloudConnected: boolean
  soundEnabled: boolean
  onToggleSound: () => void
  onStartSession: (sessionId: string) => void
  onPauseSession: (sessionId: string) => void
  onResumeSession: (sessionId: string) => void
  onResetSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onCreateSession: (challengeId: string, customTime?: number) => void
  onSaveChallenge: (ch: Challenge) => Promise<void> | void
  onDeleteChallenge: (id: string) => void
  onClearLeaderboard: () => void
  onUpdateSettings: (s: AppSettings) => void
  onResetAll: () => void
  onSimulateBot: (sessionId: string) => void
  onForceRevealNextHint: (sessionId: string) => void
  onRemovePlayer: (playerId: string) => void
  onClearSessionPlayers: (sessionId: string) => void
  onNavigateToPlayer: () => void
  onNotify: (msg: string) => void
}

export const AdminPage: React.FC<AdminPageProps> = ({
  challenges,
  sessions,
  players,
  scores,
  settings,
  cloudConnected,
  soundEnabled,
  onToggleSound,
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
  onForceRevealNextHint,
  onRemovePlayer,
  onClearSessionPlayers,
  onNavigateToPlayer,
  onNotify
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const activeSessionCount = sessions.filter((s) => s.status === 'playing').length

  const handleLogout = () => {
    setIsAuthenticated(false)
    sound.playClick()
    onNotify('Logged out of Admin Portal')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Dedicated Admin Header */}
      <header className="app-header" style={{ borderBottomColor: 'rgba(0, 245, 160, 0.25)' }}>
        {/* Brand & Admin Command Indicator */}
        <div className="brand-group">
          <div className="brand-icon" style={{ borderColor: 'var(--neon-cyan)', color: 'var(--neon-cyan)' }}>
            <Shield size={20} strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-title">
              CRACK<span>VAULT</span>
            </div>
          </div>
          <span className="badge badge-amber" style={{ fontSize: '0.65rem', padding: '0.2rem 0.55rem', marginLeft: '0.75rem' }}>
            ADMIN COMMAND
          </span>
          <span
            className={`badge ${cloudConnected ? 'badge-cyan' : ''}`}
            style={{
              fontSize: '0.65rem',
              background: cloudConnected ? undefined : 'rgba(255,255,255,0.05)',
              color: cloudConnected ? undefined : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
            title={cloudConnected ? 'MongoDB Atlas live database connected via Express' : 'Local database fallback'}
          >
            <Database size={11} />
            {cloudConnected ? 'MONGO ATLAS CONNECTED' : 'LOCAL CACHE'}
          </span>
        </div>

        {/* Action Controls on Top Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Quick Switch to Player Arena */}
          <button
            className="btn-secondary"
            onClick={onNavigateToPlayer}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderColor: 'rgba(0, 216, 246, 0.35)',
              color: 'var(--neon-cyan)'
            }}
            title="Switch to contestant view"
          >
            <Users size={14} />
            <span>Contestant View</span>
          </button>

          {/* Sound Toggle */}
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

          {/* Logout if authenticated */}
          {isAuthenticated && (
            <button
              className="btn-icon"
              onClick={handleLogout}
              title="Logout from Admin Portal"
              style={{ color: 'var(--neon-crimson)', width: '34px', height: '34px' }}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="main-wrapper" style={{ flex: 1 }}>
        {!isAuthenticated ? (
          <AdminAuth
            onSuccess={() => {
              setIsAuthenticated(true)
              onNotify('Admin credentials verified — Welcome to Mission Control')
            }}
            onCancel={onNavigateToPlayer}
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
            onStartSession={onStartSession}
            onPauseSession={onPauseSession}
            onResumeSession={onResumeSession}
            onResetSession={onResetSession}
            onDeleteSession={onDeleteSession}
            onCreateSession={onCreateSession}
            onSaveChallenge={onSaveChallenge}
            onDeleteChallenge={onDeleteChallenge}
            onClearLeaderboard={onClearLeaderboard}
            onUpdateSettings={onUpdateSettings}
            onResetAll={onResetAll}
            onSimulateBot={onSimulateBot}
            onLogout={handleLogout}
            onNotify={onNotify}
            onForceRevealNextHint={onForceRevealNextHint}
            onRemovePlayer={onRemovePlayer}
            onClearSessionPlayers={onClearSessionPlayers}
          />
        )}
      </main>

      {/* Admin Footer */}
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
          <span>CRACKVAULT SERVER &amp; MISSION CONTROL • Express + MongoDB Atlas Backend</span>
        </div>
        <div>
          <button
            onClick={onNavigateToPlayer}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <ArrowLeft size={12} /> Exit to Player Arena
          </button>
        </div>
      </footer>
    </div>
  )
}
