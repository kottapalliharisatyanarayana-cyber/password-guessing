import React, { useState, useEffect } from 'react'
import { AppSettings } from '../../types'
import { sound } from '../../lib/sound'
import {
  getFirebaseConfig,
  saveFirebaseConfig,
  clearFirebaseConfig,
  isFirebaseConnected,
  FirebaseConfig
} from '../../lib/firebase'
import {
  Settings,
  Lock,
  Volume2,
  VolumeX,
  RotateCcw,
  Cloud,
  CheckCircle2,
  ExternalLink,
  Zap,
  Info
} from 'lucide-react'

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

  // Firebase Realtime State
  const [firebaseConnected, setFirebaseConnected] = useState(isFirebaseConnected())
  const [databaseUrl, setDatabaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [projectId, setProjectId] = useState('')
  const [rawSnippet, setRawSnippet] = useState('')
  const [cloudMessage, setCloudMessage] = useState<string | null>(null)

  useEffect(() => {
    const existing = getFirebaseConfig()
    if (existing) {
      setDatabaseUrl(existing.databaseURL || '')
      setApiKey(existing.apiKey || '')
      setProjectId(existing.projectId || '')
    }
    setFirebaseConnected(isFirebaseConnected())
  }, [])

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

  const handleParseSnippet = () => {
    if (!rawSnippet.trim()) return
    try {
      // Extract apiKey
      const keyMatch = rawSnippet.match(/apiKey:\s*["']([^"']+)["']/)
      // Extract databaseURL
      const dbMatch = rawSnippet.match(/databaseURL:\s*["']([^"']+)["']/)
      // Extract projectId
      const projMatch = rawSnippet.match(/projectId:\s*["']([^"']+)["']/)

      if (keyMatch && keyMatch[1]) setApiKey(keyMatch[1])
      if (dbMatch && dbMatch[1]) setDatabaseUrl(dbMatch[1])
      if (projMatch && projMatch[1]) setProjectId(projMatch[1])

      setCloudMessage('Config parsed from snippet! Click "Save & Connect Cloud" below.')
    } catch {
      setCloudMessage('Could not automatically parse snippet. Please copy fields manually.')
    }
  }

  const handleSaveFirebase = (e: React.FormEvent) => {
    e.preventDefault()
    if (!databaseUrl.trim() || !apiKey.trim()) {
      setCloudMessage('Please provide both Database URL and API Key.')
      return
    }

    const cfg: FirebaseConfig = {
      apiKey: apiKey.trim(),
      databaseURL: databaseUrl.trim().replace(/\/$/, ''),
      projectId: projectId.trim(),
      authDomain: `${projectId.trim()}.firebaseapp.com`
    }

    saveFirebaseConfig(cfg)
    const connected = isFirebaseConnected()
    setFirebaseConnected(connected)
    sound.playClick()
    if (connected) {
      setCloudMessage('⚡ Firebase Connected! All phones, laptops, and devices can now join live rooms in real time.')
      onNotify('Cloud Sync Connected')
    } else {
      setCloudMessage('Configuration saved, but could not connect. Check the Database URL format.')
    }
  }

  const handleClearFirebase = () => {
    clearFirebaseConfig()
    setDatabaseUrl('')
    setApiKey('')
    setProjectId('')
    setRawSnippet('')
    setFirebaseConnected(false)
    setCloudMessage('Firebase configuration removed. System reverted to local-only mode.')
    sound.playClick()
    onNotify('Cloud sync disconnected')
  }

  const handleFactoryReset = () => {
    if (confirm('CAUTION: This will reset all challenges, scores, and sessions back to factory defaults. Continue?')) {
      onResetAll()
      sound.playClick()
      onNotify('System restored to clean defaults')
    }
  }

  return (
    <div style={{ maxWidth: '820px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>Platform Settings</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Configure administrator access, cross-device multiplayer cloud sync, session durations, and audio feedback.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {/* Cross-Device Multiplayer (Firebase Cloud Sync) */}
        <div className="glass-panel" style={{ padding: '1.75rem', borderColor: firebaseConnected ? 'rgba(0,245,160,0.3)' : 'rgba(0,210,255,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Cloud size={20} style={{ color: firebaseConnected ? 'var(--neon-mint)' : 'var(--neon-cyan)' }} />
              Cross-Device Cloud Multiplayer (Firebase)
            </h3>
            <span
              className={`badge ${firebaseConnected ? 'badge-mint' : ''}`}
              style={{
                fontSize: '0.72rem',
                background: firebaseConnected ? undefined : 'rgba(255,255,255,0.06)',
                color: firebaseConnected ? undefined : 'var(--text-muted)'
              }}
            >
              {firebaseConnected ? '🟢 CLOUD SYNC LIVE' : '⚪ LOCAL SINGLE-DEVICE MODE'}
            </span>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: '1.45' }}>
            Connecting a free Firebase Realtime Database enables players on <strong>separate laptops, tablets, and smartphones</strong> to join your room PIN (e.g., <code>SYNAPSE9</code>) across the internet.
          </p>

          {cloudMessage && (
            <div
              style={{
                padding: '0.65rem 1rem',
                background: firebaseConnected ? 'rgba(0,245,160,0.12)' : 'rgba(0,210,255,0.12)',
                border: `1px solid ${firebaseConnected ? 'var(--neon-mint)' : 'var(--neon-cyan)'}`,
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                marginBottom: '1rem'
              }}
            >
              {cloudMessage}
            </div>
          )}

          <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Info size={14} style={{ color: 'var(--neon-cyan)' }} />
              <span>Quick Paste (Paste entire <code>const firebaseConfig = ...</code> snippet from Firebase Console):</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="input-field"
                value={rawSnippet}
                onChange={(e) => setRawSnippet(e.target.value)}
                placeholder='paste firebaseConfig = { apiKey: "...", databaseURL: "..." }'
                style={{ fontSize: '0.78rem', fontFamily: 'monospace' }}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleParseSnippet}
                style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}
              >
                Auto-Fill
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveFirebase}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Realtime Database URL *
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={databaseUrl}
                  onChange={(e) => setDatabaseUrl(e.target.value)}
                  placeholder="https://your-project-rtdb.firebaseio.com"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  API Key *
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                  Project ID
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="password-guessing"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button type="submit" className="btn-primary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.82rem' }}>
                <Zap size={14} />
                <span>Save &amp; Connect Cloud</span>
              </button>

              {firebaseConnected && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleClearFirebase}
                  style={{ padding: '0.6rem 1rem', fontSize: '0.82rem' }}
                >
                  Disconnect Cloud
                </button>
              )}

              <a
                href="https://console.firebase.google.com/"
                target="_blank"
                rel="noreferrer"
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.76rem',
                  color: 'var(--neon-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  textDecoration: 'none'
                }}
              >
                <span>Free Firebase Console</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </form>
        </div>

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
