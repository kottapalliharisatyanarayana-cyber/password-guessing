import React from 'react'
import { sound } from '../lib/sound'
import { Shield, Users, Lock, Volume2, VolumeX, LogOut } from 'lucide-react'

interface NavbarProps {
  currentMode: 'player' | 'admin'
  onSelectMode: (mode: 'player' | 'admin') => void
  soundEnabled: boolean
  onToggleSound: () => void
  activeSessionCount: number
  cloudConnected?: boolean
  isAdminLoggedIn?: boolean
  isAdminRoute?: boolean
  onLogoutAdmin?: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
  soundEnabled,
  onToggleSound,
  activeSessionCount,
  cloudConnected,
  isAdminLoggedIn,
  isAdminRoute,
  onLogoutAdmin
}) => {
  return (
    <header className="app-header">
      {/* Brand Identity */}
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

      {/* Mode Switcher Pill - STRICTLY restricted to Admin Portal / Authenticated Admin */}
      {(isAdminLoggedIn || isAdminRoute) && (
        <div className="mode-toggle animate-fade-in">
          <button
            className={currentMode === 'player' ? 'active' : ''}
            onClick={() => {
              onSelectMode('player')
              sound.playClick()
            }}
          >
            <Users size={15} />
            <span>Player Arena</span>
          </button>

          <button
            className={currentMode === 'admin' ? 'active' : ''}
            onClick={() => {
              onSelectMode('admin')
              sound.playClick()
            }}
          >
            <Lock size={15} />
            <span>Admin Command</span>
          </button>
        </div>
      )}

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        {isAdminLoggedIn && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-amber" style={{ fontSize: '0.65rem', padding: '0.2rem 0.55rem' }}>
              ADMIN CONSOLE
            </span>
            {onLogoutAdmin && (
              <button
                className="btn-icon"
                onClick={() => {
                  onLogoutAdmin()
                  sound.playClick()
                }}
                title="Logout from Admin Portal"
                style={{ color: 'var(--neon-crimson)', width: '32px', height: '32px' }}
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        )}

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
  )
}
