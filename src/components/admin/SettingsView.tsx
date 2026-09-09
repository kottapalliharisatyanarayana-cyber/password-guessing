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
import { apiCheckHealth } from '../../lib/api'
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
  Info,
  Radio,
  Database
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

  // MongoDB Atlas State
  const [mongoStatus, setMongoStatus] = useState<{
    connected: boolean
    host?: string
    database?: string
    checking?: boolean
    message?: string
  }>({
    connected: true,
    host: 'cluster0.18sjvym.mongodb.net',
    database: 'crackvault'
  })

  // Firebase Realtime State
  const [firebaseConnected, setFirebaseConnected] = useState(isFirebaseConnected())
  const [databaseUrl, setDatabaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [projectId, setProjectId] = useState('')
  const [rawSnippet, setRawSnippet] = useState('')
  const [cloudMessage, setCloudMessage] = useState<string | null>(null)

  const checkMongoHealth = async () => {
    setMongoStatus((prev) => ({ ...prev, checking: true }))
    try {
      const res = await apiCheckHealth()
      if (res && res.database?.status === 'connected') {
        setMongoStatus({
          connected: true,
          host: res.database.host || 'cluster0.18sjvym.mongodb.net',
          database: res.database.name || 'crackvault',
          checking: false,
          message: '⚡ Connected to MongoDB Atlas cluster successfully!'
        })
        sound.playClick()
      } else {
        setMongoStatus({
          connected: false,
          checking: false,
          message: 'Backend server is active, but MongoDB is in fallback mode.'
        })
      }
    } catch {
      setMongoStatus({
        connected: false,
        checking: false,
        message: 'Could not reach Express backend at /api/health'
      })
    }
  }

  useEffect(() => {
    const existing = getFirebaseConfig()
    if (existing) {
      setDatabaseUrl(existing.databaseURL || '')
      setApiKey(existing.apiKey || '')
      setProjectId(existing.projectId || '')
    }
    setFirebaseConnected(isFirebaseConnected())
    checkMongoHealth()
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
      const keyMatch = rawSnippet.match(/apiKey:\s*["']([^"']+)["']/)
      const dbMatch = rawSnippet.match(/databaseURL:\s*["']([^"']+)["']/)
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
    setCloudMessage('Firebase configuration removed.')
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

  const anyCloudLive = mongoStatus.connected || firebaseConnected

  return (
    <div style={{ maxWidth: '820px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>Platform Settings</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Configure administrator access, MongoDB Atlas cloud database synchronization, session durations, and audio feedback.
        </p>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {/* PRIMARY: MongoDB Atlas Cloud Database */}
        <div
          className="glass-panel"
          style={{
            padding: '1.75rem',
            borderColor: mongoStatus.connected ? 'rgba(0,245,160,0.4)' : 'rgba(255,255,255,0.1)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.5rem'
            }}
          >
            <h3
              style={{
                fontSize: '1.1rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: 0
              }}
            >
              <Database size={20} style={{ color: 'var(--neon-mint)' }} />
              <span>MongoDB Atlas Cloud Database &amp; Backend</span>
            </h3>
            <span
              className={`badge ${mongoStatus.connected ? 'badge-mint' : ''}`}
              style={{
                fontSize: '0.72rem',
                background: mongoStatus.connected ? undefined : 'rgba(255,255,255,0.06)',
                color: mongoStatus.connected ? undefined : 'var(--text-muted)'
              }}
            >
              {mongoStatus.connected ? '🟢 CONNECTED TO MONGO ATLAS' : '⚪ DISCONNECTED'}
            </span>
          </div>

          <p
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              marginBottom: '1.25rem',
              lineHeight: '1.45'
            }}
          >
            Your game sessions, player lobbies, mission challenges, and leaderboard scores are persisted in
            real time to your dedicated <strong>MongoDB Atlas</strong> cluster.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '1.25rem'
            }}
          >
            <div
              style={{
                padding: '0.85rem 1rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Cluster Shard Host
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginTop: '0.2rem' }}>
                {mongoStatus.host || 'cluster0.18sjvym.mongodb.net'}
              </div>
            </div>

            <div
              style={{
                padding: '0.85rem 1rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Database Name
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--neon-cyan)', marginTop: '0.2rem' }}>
                {mongoStatus.database || 'crackvault'}
              </div>
            </div>

            <div
              style={{
                padding: '0.85rem 1rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid rgba(255,255,255,0.06)'
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Collections
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--neon-mint)', marginTop: '0.2rem' }}>
                sessions · players · challenges · scores
              </div>
            </div>
          </div>

          {mongoStatus.message && (
            <div
              style={{
                padding: '0.65rem 1rem',
                background: mongoStatus.connected ? 'rgba(0,245,160,0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${mongoStatus.connected ? 'var(--neon-mint)' : 'rgba(255,255,255,0.1)'}`,
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.82rem',
                marginBottom: '1rem'
              }}
            >
              {mongoStatus.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={checkMongoHealth}
              disabled={mongoStatus.checking}
              style={{
                padding: '0.6rem 1.25rem',
                fontSize: '0.82rem',
                background: 'linear-gradient(135deg, #00F5A0, #00D8F6)',
                color: '#000',
                fontWeight: 700
              }}
            >
              <Zap size={14} />
              <span>{mongoStatus.checking ? 'Testing...' : 'Test Atlas Connection'}</span>
            </button>

            <a
              href="https://cloud.mongodb.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{
                padding: '0.6rem 1rem',
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <span>MongoDB Atlas Cloud Console</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* SECONDARY: Firebase Cloud Sync */}
        <div className="glass-panel" style={{ padding: '1.5rem', opacity: mongoStatus.connected ? 0.75 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Cloud size={18} style={{ color: firebaseConnected ? 'var(--neon-mint)' : 'var(--neon-cyan)' }} />
              Alternative: Firebase Realtime Database
            </h3>
            <span
              className={`badge ${firebaseConnected ? 'badge-mint' : ''}`}
              style={{
                fontSize: '0.68rem',
                background: firebaseConnected ? undefined : 'rgba(255,255,255,0.06)',
                color: firebaseConnected ? undefined : 'var(--text-muted)'
              }}
            >
              {firebaseConnected ? '🟢 FIREBASE ACTIVE' : '⚪ INACTIVE'}
            </span>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Optional fallback: If you prefer Google Firebase over MongoDB Atlas, you can paste your Firebase credentials here.
          </p>

          {cloudMessage && (
            <div
              style={{
                padding: '0.6rem 0.85rem',
                background: 'rgba(0,210,255,0.12)',
                border: '1px solid var(--neon-cyan)',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.78rem',
                marginBottom: '1rem'
              }}
            >
              {cloudMessage}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              className="input-field"
              value={rawSnippet}
              onChange={(e) => setRawSnippet(e.target.value)}
              placeholder='paste firebaseConfig = { apiKey: "...", databaseURL: "..." }'
              style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={handleParseSnippet}
              style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }}
            >
              Auto-Fill
            </button>
          </div>

          <form onSubmit={handleSaveFirebase}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <input
                  type="text"
                  className="input-field"
                  value={databaseUrl}
                  onChange={(e) => setDatabaseUrl(e.target.value)}
                  placeholder="Database URL"
                  style={{ fontSize: '0.75rem' }}
                />
              </div>
              <div>
                <input
                  type="text"
                  className="input-field"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="API Key"
                  style={{ fontSize: '0.75rem' }}
                />
              </div>
              <div>
                <input
                  type="text"
                  className="input-field"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="Project ID"
                  style={{ fontSize: '0.75rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}>
                Save Firebase
              </button>
              {firebaseConnected && (
                <button type="button" className="btn-secondary" onClick={handleClearFirebase} style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}>
                  Disconnect
                </button>
              )}
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
