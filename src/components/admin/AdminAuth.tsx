import React, { useState } from 'react'
import { sound } from '../../lib/sound'
import { Shield, Lock, User, Eye, EyeOff, ArrowRight } from 'lucide-react'

interface AdminAuthProps {
  onSuccess: () => void
  onCancel?: () => void
  adminUsername?: string
  adminPasswordHash: string
}

export const AdminAuth: React.FC<AdminAuthProps> = ({
  onSuccess,
  onCancel,
  adminUsername = 'admin',
  adminPasswordHash = 'admin123'
}) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [shake, setShake] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    const expectedUser = (adminUsername || 'admin').trim().toLowerCase()
    const inputUser = username.trim().toLowerCase()
    const expectedPass = (adminPasswordHash || 'admin123').trim()
    const inputPass = password.trim()

    if (inputUser === expectedUser && inputPass === expectedPass) {
      sound.playClick()
      onSuccess()
    } else {
      sound.playError()
      setErrorMsg('Invalid administrator credentials. Access denied.')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="animate-fade-in-up" style={{ maxWidth: '440px', margin: '3.5rem auto' }}>
      <div className="glass-panel" style={{ padding: '2.5rem' }}>
        {/* Header Icon */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
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
              margin: '0 auto 1.25rem',
              boxShadow: '0 0 25px rgba(0, 245, 160, 0.35)'
            }}
          >
            <Shield size={28} />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', marginBottom: '0.35rem', color: '#fff' }}>
            Administrator Login
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Enter your authorized credentials to manage sessions, challenges, and settings.
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 51, 102, 0.15)',
              border: '1px solid var(--neon-crimson)',
              color: 'var(--neon-crimson)',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              textAlign: 'center'
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ animation: shake ? 'shake 0.4s ease-in-out' : undefined }}>
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
                placeholder="Enter username"
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
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
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
                  color: 'var(--text-muted)'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Login Submit Button */}
          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem' }}
          >
            Sign In to Dashboard <ArrowRight size={16} />
          </button>

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
        </form>
      </div>
    </div>
  )
}
