import React, { useState } from 'react'
import { Challenge, Difficulty, HintItem, HintType } from '../../types'
import { sound } from '../../lib/sound'
import { HINT_POINT_COSTS } from '../../lib/storage'
import {
  Plus,
  Edit2,
  Trash2,
  KeyRound,
  Search,
  Filter,
  Check,
  AlertCircle,
  Clock,
  Eye,
  Image as ImageIcon,
  FileText,
  Upload,
  X,
  ExternalLink
} from 'lucide-react'

interface ChallengeCrudProps {
  challenges: Challenge[]
  onSaveChallenge: (challenge: Challenge) => Promise<void> | void
  onDeleteChallenge: (id: string) => void
  onNotify: (msg: string) => void
}

const formatSeconds = (sec: number) => {
  const m = Math.floor(Math.max(0, sec) / 60)
  const s = Math.max(0, sec) % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const DEFAULT_HINT_ITEMS: HintItem[] = [
  { type: 'text', content: '', caption: '', unlockAfterSeconds: 30 },
  { type: 'text', content: '', caption: '', unlockAfterSeconds: 60 },
  { type: 'text', content: '', caption: '', unlockAfterSeconds: 120 },
  { type: 'text', content: '', caption: '', unlockAfterSeconds: 180 },
  { type: 'text', content: '', caption: '', unlockAfterSeconds: 240 }
]

const EMPTY_FORM: Omit<Challenge, 'id' | 'createdAt'> & { hintItems: HintItem[] } = {
  title: '',
  category: 'Cryptography',
  password: '',
  caseSensitive: false,
  hints: ['', '', '', '', ''],
  hintItems: DEFAULT_HINT_ITEMS,
  hintIntervalSeconds: 45,
  imageUrl: '',
  isImageClue: false,
  visualClueUnlockSeconds: 260,
  timeLimit: 300,
  difficulty: 'Medium',
  isActive: true
}

export const ChallengeCrud: React.FC<ChallengeCrudProps> = ({
  challenges,
  onSaveChallenge,
  onDeleteChallenge,
  onNotify
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('ALL')
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null)
  const [formData, setFormData] = useState<Omit<Challenge, 'id' | 'createdAt'> & { hintItems: HintItem[] }>(EMPTY_FORM)
  const [showModal, setShowModal] = useState(false)

  const filteredChallenges = challenges.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.password.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDiff = selectedDifficulty === 'ALL' || c.difficulty === selectedDifficulty
    return matchesSearch && matchesDiff
  })

  const handleOpenCreate = () => {
    setEditingChallenge(null)
    setFormData({
      ...EMPTY_FORM,
      hintItems: [
        { type: 'text', content: '', caption: '', unlockAfterSeconds: 30 },
        { type: 'text', content: '', caption: '', unlockAfterSeconds: 60 },
        { type: 'text', content: '', caption: '', unlockAfterSeconds: 120 },
        { type: 'text', content: '', caption: '', unlockAfterSeconds: 180 },
        { type: 'text', content: '', caption: '', unlockAfterSeconds: 240 }
      ]
    })
    setShowModal(true)
    sound.playClick()
  }

  const handleOpenEdit = (c: Challenge) => {
    setEditingChallenge(c)
    const interval = c.hintIntervalSeconds || 45
    const hintItems: HintItem[] = [0, 1, 2, 3, 4].map((i) => {
      if (c.hintItems && c.hintItems[i]) {
        return {
          ...c.hintItems[i],
          unlockAfterSeconds: c.hintItems[i].unlockAfterSeconds ?? (i + 1) * interval
        }
      }
      const raw = c.hints[i] || ''
      const isImg = raw.startsWith('data:image/') || /^https?:\/\/.*\.(png|jpe?g|webp|gif|svg)/i.test(raw)
      return {
        type: isImg ? 'image' : 'text',
        content: raw,
        caption: '',
        unlockAfterSeconds: (i + 1) * interval
      }
    })

    setFormData({
      title: c.title,
      category: c.category,
      password: c.password,
      caseSensitive: c.caseSensitive || false,
      hints: [...c.hints],
      hintItems,
      hintIntervalSeconds: interval,
      imageUrl: c.imageUrl || '',
      isImageClue: c.isImageClue || false,
      visualClueUnlockSeconds: c.visualClueUnlockSeconds ?? Math.round(c.timeLimit * 0.85),
      timeLimit: c.timeLimit,
      difficulty: c.difficulty,
      isActive: c.isActive
    })
    setShowModal(true)
    sound.playClick()
  }

  const updateHintItem = (index: number, partial: Partial<HintItem>) => {
    const currentItems: HintItem[] =
      formData.hintItems && formData.hintItems.length === 5
        ? [...formData.hintItems]
        : [0, 1, 2, 3, 4].map((i) => ({
            type: 'text' as const,
            content: formData.hints?.[i] || '',
            caption: ''
          }))
    currentItems[index] = { ...currentItems[index], ...partial }
    const updatedHints = [...(formData.hints || ['', '', '', '', ''])] as [string, string, string, string, string]
    updatedHints[index] = currentItems[index].content
    setFormData({
      ...formData,
      hintItems: currentItems,
      hints: updatedHints
    })
  }

  const handleHintFileUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2.5 * 1024 * 1024) {
      alert('Image file size must be under 2.5MB for browser storage.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      updateHintItem(index, { content: result, type: 'image' })
      sound.playClick()
      onNotify(`Image uploaded for Hint #${index + 1}`)
    }
    reader.readAsDataURL(file)
  }

  const handleVisualClueUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2.5 * 1024 * 1024) {
      alert('Image file size must be under 2.5MB for browser storage.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      setFormData((prev) => ({ ...prev, imageUrl: result, isImageClue: true }))
      sound.playClick()
      onNotify('Visual clue image uploaded!')
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.password.trim()) {
      alert('Please enter a challenge title and target password.')
      return
    }

    const hintItemsList = formData.hintItems || []
    const hints: [string, string, string, string, string] = [
      hintItemsList[0]?.content || formData.hints?.[0] || '',
      hintItemsList[1]?.content || formData.hints?.[1] || '',
      hintItemsList[2]?.content || formData.hints?.[2] || '',
      hintItemsList[3]?.content || formData.hints?.[3] || '',
      hintItemsList[4]?.content || formData.hints?.[4] || ''
    ]

    const saved: Challenge = {
      id: editingChallenge ? editingChallenge.id : 'c_' + Date.now(),
      createdAt: editingChallenge ? editingChallenge.createdAt : new Date().toISOString(),
      ...formData,
      hints
    }

    try {
      await onSaveChallenge(saved)
      setShowModal(false)
      sound.playClick()
      onNotify(editingChallenge ? 'Challenge updated successfully' : 'New challenge created!')
    } catch (err: any) {
      console.error('Error saving challenge:', err)
      alert('Failed to save challenge: ' + (err?.message || 'Unknown error'))
    }
  }

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete challenge "${title}"?`)) {
      onDeleteChallenge(id)
      sound.playClick()
      onNotify('Challenge deleted')
    }
  }

  return (
    <div>
      {/* Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>Challenge Workshop (CRUD)</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Design and configure cracking challenges, progressive hints, and target passwords.
          </p>
        </div>
        <button className="btn-primary" onClick={handleOpenCreate}>
          <Plus size={16} /> Create Challenge
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, category, or secret key..."
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.88rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Difficulty:</span>
          {['ALL', 'Easy', 'Medium', 'Hard', 'Insane'].map((d) => (
            <button
              key={d}
              className={`btn-secondary ${selectedDifficulty === d ? 'active' : ''}`}
              onClick={() => setSelectedDifficulty(d)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                borderColor: selectedDifficulty === d ? 'var(--neon-mint)' : undefined,
                color: selectedDifficulty === d ? 'var(--neon-mint)' : undefined
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Challenges Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '0.85rem 1.25rem' }}>Title &amp; Category</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Target Password</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Difficulty</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Time Limit</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Clues</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Status</th>
              <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredChallenges.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(0, 216, 246, 0.12)',
                      border: '1px solid var(--neon-cyan)',
                      color: 'var(--neon-cyan)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1rem'
                    }}
                  >
                    <KeyRound size={24} />
                  </div>
                  <h4 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '0.35rem' }}>
                    {challenges.length === 0 ? 'Challenge Workshop Is Empty' : 'No matching challenges found'}
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
                    {challenges.length === 0
                      ? 'No challenges currently loaded. Click the button below to forge your first puzzle secret key and progressive hints.'
                      : 'Try adjusting your search query or difficulty filter.'}
                  </p>
                  {challenges.length === 0 && (
                    <button className="btn-primary" onClick={handleOpenCreate}>
                      <Plus size={15} /> Create First Challenge
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredChallenges.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '0.85rem 1.25rem' }}>
                    <strong style={{ color: '#fff', display: 'block' }}>{c.title}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.category}</span>
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem', fontFamily: 'var(--font-mono)' }}>
                    <code style={{ color: 'var(--neon-mint)', background: 'rgba(0, 245, 160, 0.08)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {c.password}
                    </code>
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem' }}>
                    <span className={`badge ${c.difficulty === 'Insane' ? 'badge-crimson' : c.difficulty === 'Hard' ? 'badge-amber' : c.difficulty === 'Medium' ? 'badge-cyan' : 'badge-mint'}`}>
                      {c.difficulty}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem', fontFamily: 'var(--font-mono)' }}>
                    {c.timeLimit}s ({Math.round(c.timeLimit / 60)}m)
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem' }}>
                    {(() => {
                      const hintItems = c.hintItems || c.hints.map((h) => ({
                        type: (h.startsWith('data:image/') || /^https?:\/\/.*\.(png|jpe?g|webp|gif|svg)/i.test(h)) ? 'image' : 'text',
                        content: h
                      }))
                      const textCount = hintItems.filter((h) => h.type === 'text' && h.content?.trim()).length
                      const imageCount = hintItems.filter((h) => h.type === 'image' && h.content?.trim()).length + (c.isImageClue && c.imageUrl ? 1 : 0)
                      return (
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {textCount > 0 && (
                            <span className="badge badge-mint" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                              <FileText size={10} /> {textCount} Text
                            </span>
                          )}
                          {imageCount > 0 && (
                            <span className="badge badge-violet" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                              <ImageIcon size={10} /> {imageCount} Image
                            </span>
                          )}
                          {textCount === 0 && imageCount === 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>0 Clues</span>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem' }}>
                    <span className={`badge ${c.isActive ? 'badge-mint' : 'badge-crimson'}`} style={{ fontSize: '0.68rem' }}>
                      {c.isActive ? 'ACTIVE' : 'DRAFT'}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.45rem', alignItems: 'center' }}>
                      <button className="btn-icon" onClick={() => handleOpenEdit(c)} title="Edit Challenge">
                        <Edit2 size={14} />
                      </button>
                      <button className="btn-icon" onClick={() => handleDelete(c.id, c.title)} style={{ color: 'var(--neon-crimson)' }} title="Delete Challenge">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '720px' }}>
            <h3 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-display)', marginBottom: '0.25rem', color: '#fff' }}>
              {editingChallenge ? 'Edit Challenge' : 'Create New Challenge'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Configure puzzle parameters, secret solution passphrase, and progressive text/image clues.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                    Challenge Title *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Project Chimera"
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                    Category
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g. Cryptography"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                    Secret Password *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="e.g. SYNAPSE-9"
                    required
                    style={{ fontWeight: 700, color: 'var(--neon-mint)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                    Difficulty
                  </label>
                  <select
                    className="input-field"
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as Difficulty })}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                    <option value="Insane">Insane</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                    Time Limit (sec)
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    value={formData.timeLimit}
                    onChange={(e) => setFormData({ ...formData, timeLimit: Number(e.target.value) })}
                    min={30}
                    max={1800}
                    step={30}
                  />
                </div>
              </div>

              {/* Tiered Hints (Text or Image) with Countdown Timing */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#fff', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', display: 'block' }}>
                      Progressive Clues (Hints 1 to 5) — Countdown Based Reveal
                    </label>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Hints unlock automatically after mission countdown reach targets. Zero score deductions.
                    </span>
                  </div>

                  {/* Interval Auto-Recalculate Quick Setter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(0, 245, 160, 0.08)', border: '1px solid rgba(0, 245, 160, 0.25)', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                    <Clock size={12} style={{ color: 'var(--neon-mint)' }} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--neon-mint)', fontWeight: 600 }}>
                      Interval:
                    </span>
                    <input
                      type="number"
                      min={10}
                      max={300}
                      step={5}
                      value={formData.hintIntervalSeconds || 45}
                      onChange={(e) => {
                        const interval = Math.max(5, Number(e.target.value))
                        const updated = (formData.hintItems || []).map((item, idx) => ({
                          ...item,
                          unlockAfterSeconds: (idx + 1) * interval
                        }))
                        setFormData({
                          ...formData,
                          hintIntervalSeconds: interval,
                          hintItems: updated
                        })
                      }}
                      style={{
                        width: '52px',
                        background: 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(0,245,160,0.4)',
                        borderRadius: '3px',
                        color: '#fff',
                        fontSize: '0.75rem',
                        padding: '0.1rem 0.3rem',
                        textAlign: 'center',
                        fontFamily: 'var(--font-mono)'
                      }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>sec/hint</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {[0, 1, 2, 3, 4].map((i) => {
                    const item =
                      (formData.hintItems && formData.hintItems[i]) || {
                        type: 'text',
                        content: (formData.hints && formData.hints[i]) || '',
                        caption: '',
                        unlockAfterSeconds: (i + 1) * (formData.hintIntervalSeconds || 45)
                      }
                    const isImage = item.type === 'image'
                    const unlockAt = item.unlockAfterSeconds ?? (i + 1) * (formData.hintIntervalSeconds || 45)

                    return (
                      <div
                        key={i}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: isImage ? '1px solid rgba(0, 216, 246, 0.3)' : '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.85rem'
                        }}
                      >
                        {/* Clue Header with Timing and Type Switcher */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                              Clue #{i + 1}
                            </span>

                            {/* Countdown Unlock Target */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(0, 216, 246, 0.08)', border: '1px solid rgba(0, 216, 246, 0.3)', borderRadius: '4px', padding: '0.15rem 0.5rem' }}>
                              <Clock size={11} style={{ color: 'var(--neon-cyan)' }} />
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Reveals at:</span>
                              <input
                                type="number"
                                min={5}
                                max={formData.timeLimit || 600}
                                step={5}
                                value={unlockAt}
                                onChange={(e) => updateHintItem(i, { unlockAfterSeconds: Math.max(0, Number(e.target.value)) })}
                                style={{
                                  width: '46px',
                                  background: 'rgba(0,0,0,0.6)',
                                  border: '1px solid rgba(0, 216, 246, 0.4)',
                                  borderRadius: '3px',
                                  color: 'var(--neon-cyan)',
                                  fontSize: '0.72rem',
                                  padding: '0.1rem 0.25rem',
                                  textAlign: 'center',
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: 700
                                }}
                              />
                              <span style={{ fontSize: '0.68rem', color: 'var(--neon-cyan)', fontFamily: 'var(--font-mono)' }}>
                                s ({formatSeconds(unlockAt)})
                              </span>
                            </div>
                          </div>

                          {/* Segmented Switch: Text or Image */}
                          <div style={{ display: 'inline-flex', background: 'rgba(6, 9, 16, 0.8)', borderRadius: 'var(--radius-sm)', padding: '2px', border: '1px solid var(--border-subtle)' }}>
                            <button
                              type="button"
                              onClick={() => updateHintItem(i, { type: 'text' })}
                              style={{
                                padding: '0.2rem 0.65rem',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                borderRadius: '4px',
                                background: !isImage ? 'rgba(0, 245, 160, 0.18)' : 'transparent',
                                color: !isImage ? 'var(--neon-mint)' : 'var(--text-muted)'
                              }}
                            >
                              <FileText size={12} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                              Text
                            </button>
                            <button
                              type="button"
                              onClick={() => updateHintItem(i, { type: 'image' })}
                              style={{
                                padding: '0.2rem 0.65rem',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                borderRadius: '4px',
                                background: isImage ? 'rgba(0, 216, 246, 0.18)' : 'transparent',
                                color: isImage ? 'var(--neon-cyan)' : 'var(--text-muted)'
                              }}
                            >
                              <ImageIcon size={12} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                              Image
                            </button>
                          </div>
                        </div>

                        {/* Hint Content Field */}
                        {!isImage ? (
                          <input
                            type="text"
                            className="input-field"
                            value={item.content || ''}
                            onChange={(e) => updateHintItem(i, { content: e.target.value })}
                            placeholder={`Enter textual clue #${i + 1} for contestants...`}
                            style={{ padding: '0.5rem 0.85rem', fontSize: '0.85rem' }}
                          />
                        ) : (
                          <div>
                            {/* URL input and Upload button */}
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <input
                                type="text"
                                className="input-field"
                                value={item.content || ''}
                                onChange={(e) => updateHintItem(i, { content: e.target.value })}
                                placeholder="Paste image URL (https://...) or upload image file..."
                                style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', flex: 1 }}
                              />
                              <label
                                htmlFor={`hint-file-${i}`}
                                className="btn-secondary"
                                style={{ padding: '0.45rem 0.85rem', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                              >
                                <Upload size={13} /> Upload Image
                              </label>
                              <input
                                id={`hint-file-${i}`}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => handleHintFileUpload(i, e)}
                              />
                            </div>

                            {/* Live Thumbnail Preview */}
                            {item.content && (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.85rem',
                                  background: 'rgba(0, 0, 0, 0.4)',
                                  padding: '0.5rem 0.75rem',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid rgba(0, 216, 246, 0.25)',
                                  marginBottom: '0.5rem'
                                }}
                              >
                                <img
                                  src={item.content}
                                  alt={`Preview for Hint ${i + 1}`}
                                  style={{
                                    width: '64px',
                                    height: '48px',
                                    objectFit: 'cover',
                                    borderRadius: '4px',
                                    border: '1px solid var(--border-subtle)'
                                  }}
                                  onError={(e) => {
                                    (e.currentTarget as HTMLElement).style.opacity = '0.3'
                                  }}
                                />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--neon-cyan)', fontWeight: 600 }}>
                                    <Check size={12} /> Image Attached &amp; Valid
                                  </div>
                                  <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.content.startsWith('data:image/') ? 'Local File (Base64 Encoded)' : item.content}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => updateHintItem(i, { content: '' })}
                                  style={{ color: 'var(--neon-crimson)', padding: '4px' }}
                                  title="Remove Image"
                                >
                                  <X size={15} />
                                </button>
                              </div>
                            )}

                            {/* Optional Caption */}
                            <input
                              type="text"
                              className="input-field"
                              value={item.caption || ''}
                              onChange={(e) => updateHintItem(i, { caption: e.target.value })}
                              placeholder="Optional caption or instructions accompanying this image..."
                              style={{ padding: '0.38rem 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Optional Visual Clue (Final Dossier Clue) */}
              <div style={{ marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: formData.isImageClue ? '0.75rem' : 0, flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600, color: '#fff' }}>
                    <input
                      type="checkbox"
                      checked={formData.isImageClue}
                      onChange={(e) => setFormData({ ...formData, isImageClue: e.target.checked })}
                    />
                    <span>Enable Optional Extra Visual Clue (Final Tactical Dossier)</span>
                  </label>

                  {formData.isImageClue && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '4px', padding: '0.15rem 0.5rem' }}>
                      <Clock size={11} style={{ color: 'var(--neon-violet)' }} />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Reveals at:</span>
                      <input
                        type="number"
                        min={10}
                        max={formData.timeLimit || 600}
                        step={5}
                        value={formData.visualClueUnlockSeconds ?? Math.round(formData.timeLimit * 0.85)}
                        onChange={(e) => setFormData({ ...formData, visualClueUnlockSeconds: Math.max(0, Number(e.target.value)) })}
                        style={{
                          width: '46px',
                          background: 'rgba(0,0,0,0.6)',
                          border: '1px solid rgba(168, 85, 247, 0.4)',
                          borderRadius: '3px',
                          color: 'var(--neon-violet)',
                          fontSize: '0.72rem',
                          padding: '0.1rem 0.25rem',
                          textAlign: 'center',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700
                        }}
                      />
                      <span style={{ fontSize: '0.68rem', color: 'var(--neon-violet)', fontFamily: 'var(--font-mono)' }}>
                        s ({formatSeconds(formData.visualClueUnlockSeconds ?? Math.round(formData.timeLimit * 0.85))})
                      </span>
                    </div>
                  )}
                </div>

                {formData.isImageClue && (
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="text"
                        className="input-field"
                        value={formData.imageUrl || ''}
                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        placeholder="Paste image URL (https://...) or upload image file..."
                        style={{ fontSize: '0.82rem', flex: 1 }}
                      />
                      <label
                        htmlFor="visual-clue-file"
                        className="btn-secondary"
                        style={{ padding: '0.45rem 0.85rem', fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Upload size={13} /> Upload File
                      </label>
                      <input
                        id="visual-clue-file"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleVisualClueUpload}
                      />
                    </div>

                    {/* Preview for Visual Clue */}
                    {formData.imageUrl && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.85rem',
                          background: 'rgba(0, 0, 0, 0.4)',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(168, 85, 247, 0.3)'
                        }}
                      >
                        <img
                          src={formData.imageUrl}
                          alt="Visual Clue Preview"
                          style={{
                            width: '64px',
                            height: '48px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)'
                          }}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.opacity = '0.3'
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--neon-violet)', fontWeight: 600 }}>
                            <Check size={12} /> Visual Clue Ready
                          </div>
                          <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {formData.imageUrl.startsWith('data:image/') ? 'Local File (Base64 Encoded)' : formData.imageUrl}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
                          style={{ color: 'var(--neon-crimson)', padding: '4px' }}
                          title="Remove Visual Clue"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Check size={15} /> Save Challenge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
