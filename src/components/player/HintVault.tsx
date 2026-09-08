import React, { useState } from 'react'
import { Challenge } from '../../types'
import {
  Lock,
  Unlock,
  Eye,
  Image as ImageIcon,
  CheckCircle2,
  FileText,
  ZoomIn,
  X,
  ExternalLink,
  Clock,
  Radio
} from 'lucide-react'

interface HintVaultProps {
  challenge: Challenge
  revealedHints: number[]
  elapsedSeconds?: number
  secondsRemaining?: number
  totalSeconds?: number
  onRevealHint?: (hintIndex: number) => void
  disabled?: boolean
}

export const HintVault: React.FC<HintVaultProps> = ({
  challenge,
  revealedHints,
  elapsedSeconds = 0,
  secondsRemaining = 0,
  totalSeconds = 300,
  disabled
}) => {
  const [zoomImage, setZoomImage] = useState<{ src: string; label: string; caption?: string } | null>(null)
  const [brokenImages, setBrokenImages] = useState<Record<number, boolean>>({})

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(Math.max(0, secs) / 60)
    const s = Math.max(0, secs) % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Construct clues items: text or image hints 1-5 + optional visual clue
  const defaultInterval = challenge.hintIntervalSeconds || 45

  const items: Array<{
    label: string
    type: 'text' | 'image'
    content: string
    caption?: string
    unlockAfterSeconds: number
    originalIndex: number
  }> = [0, 1, 2, 3, 4].map((i) => {
    const hintObj = challenge.hintItems?.[i]
    const raw = hintObj?.content || challenge.hints[i] || ''
    const isImg = hintObj
      ? hintObj.type === 'image'
      : raw.startsWith('data:image/') || /^https?:\/\/.*\.(png|jpe?g|webp|gif|svg)/i.test(raw)
    const unlockSeconds = hintObj?.unlockAfterSeconds ?? (i + 1) * defaultInterval

    return {
      label: `Clue #${i + 1}`,
      type: isImg ? ('image' as const) : ('text' as const),
      content: raw || `Hint #${i + 1}`,
      caption: hintObj?.caption,
      unlockAfterSeconds: unlockSeconds,
      originalIndex: i
    }
  })

  // Optional 6th visual dossier clue
  if (challenge.isImageClue && challenge.imageUrl) {
    const visualUnlock = challenge.visualClueUnlockSeconds ?? Math.round(challenge.timeLimit * 0.85)
    items.push({
      label: 'Visual Dossier',
      type: 'image',
      content: challenge.imageUrl,
      caption: 'Tactical intelligence visual clue',
      unlockAfterSeconds: visualUnlock,
      originalIndex: 5
    })
  }

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
            <Eye size={18} style={{ color: 'var(--neon-cyan)' }} />
            Tactical Hint Vault
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Hints unlock strictly on the mission countdown clock. Zero score penalty deductions.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-mint" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Clock size={11} /> 0 pt Deduction
          </span>
          <span className="badge badge-cyan">
            {revealedHints.length} / {items.length} Unlocked
          </span>
        </div>
      </div>

      {/* Clues List */}
      <div style={{ display: 'grid', gap: '0.85rem' }}>
        {items.map((item, idx) => {
          const isRevealed = revealedHints.includes(item.originalIndex)
          const isImage = item.type === 'image'
          const isBroken = brokenImages[idx]
          const secondsUntilUnlock = Math.max(0, item.unlockAfterSeconds - elapsedSeconds)
          const unlockProgress = Math.min(100, Math.max(0, (elapsedSeconds / item.unlockAfterSeconds) * 100))

          return (
            <div
              key={idx}
              style={{
                background: isRevealed
                  ? 'rgba(0, 245, 160, 0.04)'
                  : 'rgba(10, 15, 29, 0.7)',
                border: isRevealed
                  ? isImage
                    ? '1px solid rgba(0, 216, 246, 0.4)'
                    : '1px solid rgba(0, 245, 160, 0.4)'
                  : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                transition: 'all 0.3s ease',
                boxShadow: isRevealed
                  ? isImage
                    ? '0 0 15px rgba(0, 216, 246, 0.08)'
                    : '0 0 15px rgba(0, 245, 160, 0.08)'
                  : 'none'
              }}
            >
              {/* Clue Item Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  {isRevealed ? (
                    <div style={{ color: isImage ? 'var(--neon-cyan)' : 'var(--neon-mint)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <CheckCircle2 size={16} />
                      <strong style={{ fontSize: '0.88rem', fontFamily: 'var(--font-mono)' }}>{item.label}</strong>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Lock size={15} style={{ color: 'var(--neon-amber)' }} />
                      <span style={{ fontSize: '0.88rem', fontFamily: 'var(--font-mono)', color: '#cbd5e1' }}>{item.label}</span>
                    </div>
                  )}

                  {/* Type Badge */}
                  {isImage ? (
                    <span className="badge badge-violet" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
                      <ImageIcon size={11} /> Image Hint
                    </span>
                  ) : (
                    <span className="badge badge-mint" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
                      <FileText size={11} /> Text Clue
                    </span>
                  )}
                </div>

                {/* Status Indicator or Live Countdown */}
                <div>
                  {isRevealed ? (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: isImage ? 'var(--neon-cyan)' : 'var(--neon-mint)',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        background: isImage ? 'rgba(0, 216, 246, 0.1)' : 'rgba(0, 245, 160, 0.1)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '4px',
                        border: `1px solid ${isImage ? 'rgba(0, 216, 246, 0.3)' : 'rgba(0, 245, 160, 0.3)'}`
                      }}
                    >
                      UNLOCKED (FREE)
                    </span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--neon-amber)',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          background: 'rgba(245, 158, 11, 0.12)',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '4px',
                          border: '1px solid rgba(245, 158, 11, 0.35)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem'
                        }}
                      >
                        <Clock size={12} />
                        UNLOCKS IN {formatTime(secondsUntilUnlock)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Locked Hint Progress Bar */}
              {!isRevealed && (
                <div style={{ marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontFamily: 'var(--font-mono)' }}>
                    <span>Unlocks at mission clock: {formatTime(item.unlockAfterSeconds)}</span>
                    <span>{Math.round(unlockProgress)}% Charged</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${unlockProgress}%`,
                        background: 'linear-gradient(90deg, var(--neon-amber), var(--neon-mint))',
                        boxShadow: '0 0 8px rgba(0, 245, 160, 0.4)',
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Revealed Content Display */}
              {isRevealed && (
                <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  {isImage ? (
                    <div>
                      {!isBroken ? (
                        <div
                          onClick={() => setZoomImage({ src: item.content, label: item.label, caption: item.caption })}
                          style={{
                            position: 'relative',
                            cursor: 'pointer',
                            borderRadius: 'var(--radius-md)',
                            overflow: 'hidden',
                            border: '1px solid rgba(0, 216, 246, 0.3)',
                            background: '#040711',
                            display: 'inline-block',
                            maxWidth: '100%',
                            transition: 'all 0.2s ease'
                          }}
                          className="interactive-hover"
                          title="Click to expand / zoom image"
                        >
                          <img
                            src={item.content}
                            alt={item.label}
                            onError={() => setBrokenImages((prev) => ({ ...prev, [idx]: true }))}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '260px',
                              display: 'block',
                              borderRadius: 'var(--radius-md)',
                              objectFit: 'contain'
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              bottom: '8px',
                              right: '8px',
                              background: 'rgba(6, 9, 16, 0.85)',
                              border: '1px solid var(--border-glow)',
                              color: 'var(--neon-mint)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.25rem 0.55rem',
                              fontSize: '0.72rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              backdropFilter: 'blur(4px)'
                            }}
                          >
                            <ZoomIn size={13} /> Click to Zoom
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            padding: '0.85rem',
                            background: 'rgba(255, 51, 102, 0.1)',
                            border: '1px solid var(--neon-crimson)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--neon-crimson)',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          <span>Image resource link: </span>
                          <a
                            href={item.content}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#fff', textDecoration: 'underline' }}
                          >
                            Open External Link <ExternalLink size={12} style={{ display: 'inline' }} />
                          </a>
                        </div>
                      )}

                      {/* Optional Caption */}
                      {item.caption && (
                        <p style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.4 }}>
                          💡 <em>{item.caption}</em>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        background: 'rgba(0, 245, 160, 0.05)',
                        borderLeft: '3px solid var(--neon-mint)',
                        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0'
                      }}
                    >
                      <p style={{ fontSize: '0.92rem', color: '#f1f5f9', lineHeight: 1.5, fontFamily: 'var(--font-mono)', margin: 0 }}>
                        "{item.content}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Lightbox Zoom Modal for Images */}
      {zoomImage && (
        <div className="modal-overlay" onClick={() => setZoomImage(null)}>
          <div
            className="modal-content"
            style={{
              maxWidth: '860px',
              padding: '1.5rem',
              background: '#070b15',
              border: '1px solid var(--neon-cyan)',
              boxShadow: '0 0 50px rgba(0, 216, 246, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={18} style={{ color: 'var(--neon-cyan)' }} />
                <h3 style={{ fontSize: '1.15rem', color: '#fff', fontFamily: 'var(--font-display)' }}>
                  {zoomImage.label} — Tactical High-Res Visual
                </h3>
              </div>
              <button
                className="btn-icon"
                onClick={() => setZoomImage(null)}
                style={{ color: '#fff', background: 'rgba(255,255,255,0.08)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                textAlign: 'center',
                background: '#000',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--border-subtle)',
                maxHeight: '70vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <img
                src={zoomImage.src}
                alt={zoomImage.label}
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                  display: 'block'
                }}
              />
            </div>

            {zoomImage.caption && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                💡 <strong>Clue Briefing:</strong> {zoomImage.caption}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
