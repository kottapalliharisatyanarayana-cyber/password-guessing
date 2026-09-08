import React, { useState } from 'react'
import { AppSettings } from '../../types'
import { sound } from '../../lib/sound'
import { Settings, Lock, User, Clock, Volume2, VolumeX, RotateCcw, ShieldCheck, CheckCircle2 } from 'lucide-react'

interface SettingsViewProps {
  settings: AppSettings
  onUpdateSettings: (settings: AppSettings) => void
  onResetAll: () => void
  onNotify: (msg: string) => void
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetAll,
  onNotify
}) => {
  const [username, setUsername] = useState(settings.adminUsername || 'admin')
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passError, setPassError] = useState<string | null>(null)
  const [passSuccess, setPassSuccess] = useState<string | null>(null)

  const [defaultTime, setDefaultTime] = useState(settings.defaultTimeLimit)
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled)

  const handleUpdateCredentials = (e: React.FormEvent) => {
    e.preventDefault()
    setPassError(null)
    setPassSuccess(null)

    if (currentPass !== settings.adminPassword) {
      setPassError('Current admin password does not match.')
      sound.playError()
      return
    }
    if (newPass.length < 4) {
      setPassError('New password must be at least 4 characters.')
      sound.playError()
      return
    }
    if (newPass !== confirmPass) {
      setPassError('New passwords do not match.')
      sound.playError()
      return
    }

    onUpdateSettings({
      ...settings,
      adminUsername: username.trim() || 'admin',
      adminPassword: newPass.trim()
    })

    setCurrentPass('')
    setNewPass('')
    setConfirmPass('')
    setPassSuccess('Administrator credentials updated successfully!')
    sound.playClick()
    onNotify('Admin credentials updated')
  }

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault()
    sound.setEnabled(soundEnabled)
    onUpdateSettings({
      ...settings,
      defaultTimeLimit: defaultTime,
      soundEnabled: soundEnabled
    })
    sound.playClick()
    onNotify('Settings saved successfully')
  }

  const handleFactoryReset = () => {
    if (confirm('CAUTION: This will reset all challenges, scores, and sessions back to factory defaults. Continue?')) {
      onResetAll()
      sound.playClick()
      onNotify('System restored to clean defaults')
    }
  }

  return (
    <div style={{ maxWidth: '780px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>Platform Settings</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Configure administrator access credentials, session durations, audio feedback, and system defaults.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {/* Administrator Credentials Card */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <Lock size={18} style={{ color: 'var(--neon-mint)' }} />
            Administrator Credentials
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Change the username and passcode required to enter the Admin Command Center.
          </p>

          {passError && (
            <div style={{ padding: '0.65rem 1rem', background: 'rgba(255,51,102,0.15)', border: '1px solid var(--neon-crimson)', color: 'var(--neon-crimson)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', marginBottom: '1rem' }}>
              {passError}
            </div>
          )}

          {passSuccess && (
            <div style={{ padding: '0.65rem 1rem', background: 'rgba(0,245,160,0.15)', border: '1px solid var(--neon-mint)', color: 'var(--neon-mint)', borderRadius: 'var(--radius-md)', fontSize: '0.82rem', marginBottom: '1rem' }}>
              {passSuccess}
            </div>
          )}

          <form onSubmit={handleUpdateCredentials}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Admin Username
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Current Password *
                </label>
                <input
                  type="password"
                  className="input-field"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  New Password *
                </label>
                <input
                  type="password"
                  className="input-field"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  className="input-field"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1.15rem', fontSize: '0.82rem' }}>
              Update Credentials
            </button>
          </form>
        </div>

        {/* General Preferences */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <Settings size={18} style={{ color: 'var(--neon-cyan)' }} />
            Game Parameters &amp; Audio
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Set session time thresholds and toggle audio feedback.
          </p>

          <form onSubmit={handleSaveGeneral}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Default Challenge Duration (seconds)
                </label>
                <input
                  type="number"
                  className="input-field"
                  value={defaultTime}
                  onChange={(e) => setDefaultTime(Number(e.target.value))}
                  min={30}
                  max={1800}
                  step={30}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Equivalent to {Math.round(defaultTime / 60)} minutes per mission
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
                  Cyber Synthesizer Sound FX
                </label>
                <button
                  type="button"
                  className={`btn-secondary ${soundEnabled ? 'active' : ''}`}
                  onClick={() => {
                    const next = !soundEnabled
                    setSoundEnabled(next)
                    sound.setEnabled(next)
                    if (next) sound.playClick()
                  }}
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    borderColor: soundEnabled ? 'var(--neon-mint)' : undefined,
                    color: soundEnabled ? 'var(--neon-mint)' : undefined
                  }}
                >
                  {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  <span>{soundEnabled ? 'Synthesizer Audio Enabled' : 'Audio Muted'}</span>
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1.15rem', fontSize: '0.82rem' }}>
              Save Preferences
            </button>
          </form>
        </div>

        {/* Danger Zone: Factory Reset */}
        <div className="glass-panel" style={{ padding: '1.75rem', borderColor: 'rgba(255, 51, 102, 0.25)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--neon-crimson)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <RotateCcw size={18} />
            System Danger Zone
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Reset all challenges, clear leaderboard records, delete active sessions, and restore system defaults.
          </p>

          <button className="btn-crimson" onClick={handleFactoryReset} style={{ fontSize: '0.82rem', padding: '0.6rem 1.15rem' }}>
            Restore Factory Defaults
          </button>
        </div>
      </div>
    </div>
  )
}
