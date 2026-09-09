import React, { useState, useEffect } from 'react'
import { sound } from '../../lib/sound'
import { apiGetSettings, apiCreateAdmin } from '../../lib/api'
import { AppSettings } from '../../types'
import { Shield, Lock, User, Eye, EyeOff, ArrowRight, UserPlus, KeyRound, Sparkles, CheckCircle2 } from 'lucide-react'

interface AdminAuthProps {
  onSuccess: () => void
  onCancel?: () => void
  adminUsername?: string
  adminPasswordHash: string
  onUpdateSettings?: (s: AppSettings) => void
}

export const AdminAuth: React.FC<AdminAuthProps> = ({
  onSuccess,
  onCancel,
  adminUsername = 'admin',
  adminPasswordHash = 'admin123',
  onUpdateSettings
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'create'>('login')

  // Login Form State
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)

  // Live MongoDB Atlas credentials cache
  const [liveExpectedUser, setLiveExpectedUser] = useState(adminUsername)
  const [liveExpectedPass, setLiveExpectedPass] = useState(adminPasswordHash)

  // Create Admin Form State
  const [newUsername, setNewUsername] = useState('admin')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)

  // Fetch live credentials directly from MongoDB Atlas on mount
  useEffect(() => {
    apiGetSettings()
      .then((settings) => {
        if (settings) {
          if (settings.adminUsername) setLiveExpectedUser(settings.adminUsername)
          if (settings.adminPassword) setLiveExpectedPass(settings.adminPassword)
        }
      })
      .catch(() => {})
  }, [])

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const expectedUser = (liveExpectedUser || adminUsername || 'admin').trim().toLowerCase()
    const inputUser = username.trim().toLowerCase()
    const expectedPass = (liveExpectedPass || adminPasswordHash || 'admin123').trim()
    const inputPass = password.trim()

    if (inputUser === expectedUser && inputPass === expectedPass) {
      sound.playClick()
      onSuccess()
    } else {
      sound.playError()
      setErrorMsg('Invalid administrator credentials. Try the default credentials below or create a new admin account.')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  const handleCreateAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const trimmedUser = newUsername.trim()
    const trimmedPass = newPassword.trim()

    if (!trimmedUser) {
      setErrorMsg('Username cannot be empty.')
      sound.playError()
      return
    }

    if (trimmedPass.length < 4) {
      setErrorMsg('Password must be at least 4 characters.')
      sound.playError()
      return
    }

    if (trimmedPass !== confirmPassword.trim()) {
      setErrorMsg('Passwords do not match.')
      sound.playError()
      return
    }

    setLoading(true)
    try {
      const res = await apiCreateAdmin(trimmedUser, trimmedPass)
      if (res) {
        setLiveExpectedUser(res.adminUsername || trimmedUser)
        setLiveExpectedPass(res.adminPassword || trimmedPass)
        onUpdateSettings?.(res)
        sound.playClick()
        setSuccessMsg(`Admin "${trimmedUser}" created in MongoDB Atlas! Entering Dashboard...`)
        setTimeout(() => {
          onSuccess()
        }, 800)
      } else {
        setErrorMsg('Failed to save admin to MongoDB Atlas backend.')
        sound.playError()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating admin')
      sound.playError()
    } finally {
      setLoading(false)
    }
  }

  const handleQuickFill = () => {
    setUsername(liveExpectedUser || 'admin')
    setPassword(liveExpectedPass || 'admin123')
    sound.playClick()
  }

  return (
    <div className="animate-fade-in-up" style={{ maxWidth: '460px', margin: '3.5rem auto' }}>
      <div className="glass-panel" style={{ padding: '2.25rem' }}>
        {/* Header Icon */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            className="animate-float"
            style={{
              width: '58px',
              height: '58px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, rgba(0, 245, 160, 0.2), rgba(0, 216, 246, 0.2))',
              border: '1px solid var(--neon-mint)',
              color: 'var(--neon-mint)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              boxShadow: '0 0 25px rgba(0, 245, 160, 0.35)'
            }}
          >
            <Shield size={28} />
          </div>
          <h2 style={{ fontSize: '1.65rem', fontFamily: 'var(--font-display)', marginBottom: '0.35rem', color: '#fff' }}>
            Mission Control
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            Verified Administrator Access • Connected directly to MongoDB Atlas
          </p>
        </div>

        {/* Tab Selector: Sign In vs Create Admin */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 'var(--radius-md)',
            padding: '4px',
            marginBottom: '1.5rem',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('login')
              setErrorMsg(null)
              sound.playClick()
            }}
            style={{
              flex: 1,
              padding: '0.55rem',
              border: 'none',
              background: activeTab === 'login' ? 'rgba(0, 245, 160, 0.15)' : 'transparent',
              color: activeTab === 'login' ? 'var(--neon-mint)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.82rem',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s'
            }}
          >
            <KeyRound size={14} /> Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('create')
              setErrorMsg(null)
              sound.playClick()
            }}
            style={{
              flex: 1,
              padding: '0.55rem',
              border: 'none',
              background: activeTab === 'create' ? 'rgba(0, 216, 246, 0.15)' : 'transparent',
              color: activeTab === 'create' ? 'var(--neon-cyan)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.82rem',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s'
            }}
          >
            <UserPlus size={14} /> Create Admin
          </button>
        </div>

        {/* Error / Success Alerts */}
        {errorMsg && (
          <div
            style={{
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 51, 102, 0.15)',
              border: '1px solid var(--neon-crimson)',
              color: 'var(--neon-crimson)',
              fontSize: '0.82rem',
              marginBottom: '1.25rem',
              textAlign: 'center'
            }}
          >
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 245, 160, 0.15)',
              border: '1px solid var(--neon-mint)',
              color: 'var(--neon-mint)',
              fontSize: '0.82rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem'
            }}
          >
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: LOGIN */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} style={{ animation: shake ? 'shake 0.4s ease-in-out' : undefined }}>
            {/* Username Input */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input-field"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin"
                  autoFocus
                  required
                  style={{ paddingLeft: '2.5rem' }}
                />
                <User
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter passcode"
                  required
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.75rem' }}
                />
                <Lock
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Quick Fill Default Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={handleQuickFill}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--neon-cyan)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}
              >
                <Sparkles size={12} /> Auto-fill Default ({liveExpectedUser || 'admin'} / {liveExpectedPass || 'admin123'})
              </button>
            </div>

            {/* Login Submit Button */}
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem' }}
            >
              Sign In to Mission Control <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* TAB 2: CREATE / RESET ADMIN */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreateAdminSubmit}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Create or reset the master administrator credentials. This saves directly to your MongoDB Atlas cluster.
            </p>

            {/* New Username Input */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                New Admin Username
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="input-field"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="admin"
                  required
                  style={{ paddingLeft: '2.5rem' }}
                />
                <User
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }}
                />
              </div>
            </div>

            {/* New Password Input */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                New Password (min. 4 chars)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="input-field"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.75rem' }}
                />
                <Lock
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)'
                  }}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="input-field"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  style={{ paddingLeft: '2.5rem' }}
                />
                <Lock
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }}
                />
              </div>
            </div>

            {/* Create Admin Submit Button */}
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '0.85rem', fontSize: '0.92rem' }}
            >
              {loading ? 'Saving to MongoDB Atlas...' : 'Create Admin in MongoDB Atlas'} <UserPlus size={16} />
            </button>
          </form>
        )}

        {/* Back Link */}
        {onCancel && (
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            style={{ width: '100%', marginTop: '0.75rem', padding: '0.75rem', fontSize: '0.85rem' }}
          >
            ← Return to Player Arena
          </button>
        )}
      </div>
    </div>
  )
}
