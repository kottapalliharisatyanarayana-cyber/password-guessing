import React from 'react'
import { sound } from '../lib/sound'
import { Shield, Users, Lock, Volume2, VolumeX, Terminal, KeyRound } from 'lucide-react'

interface NavbarProps {
  currentMode: 'player' | 'admin'
  onSelectMode: (mode: 'player' | 'admin') => void
  soundEnabled: boolean
  onToggleSound: () => void
  activeSessionCount: number
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
  soundEnabled,
  onToggleSound,
  activeSessionCount
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
        </div>
      </div>

      {/* Mode Switcher Pill */}
      <div className="mode-toggle">
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

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
