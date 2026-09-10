import React, { useState, useMemo } from 'react'
import { ScoreEntry, Challenge, GameSession, GamePlayer } from '../../types'
import { sound } from '../../lib/sound'
import {
  Trophy,
  Clock,
  Zap,
  Eye,
  Search,
  Trash2,
  Flag,
  Target,
  Award,
  CheckCircle,
  FileSpreadsheet,
  FileText,
  Users,
  AlertCircle
} from 'lucide-react'

export interface LeaderboardParticipant {
  id: string
  name: string
  avatar?: string
  eventTitle: string
  joinCode?: string
  status: 'solved' | 'playing' | 'failed' | 'waiting'
  solveTime?: number // seconds
  score: number
  attempts: number
  hintsRevealed: number
  completedAt?: string
  isOfficialScore: boolean
}

interface LeaderboardViewProps {
  scores: ScoreEntry[]
  challenges?: Challenge[]
  sessions?: GameSession[]
  players?: GamePlayer[]
  onClearLeaderboard?: () => void
  onNotify?: (msg: string) => void
  readOnly?: boolean
}

const formatSeconds = (sec: number | null | undefined): string => {
  if (sec === null || sec === undefined || sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  scores,
  challenges = [],
  sessions = [],
  players = [],
  onClearLeaderboard,
  onNotify,
  readOnly = false
}) => {
  const [selectedEvent, setSelectedEvent] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SOLVED' | 'ACTIVE'>('ALL')
  const [search, setSearch] = useState<string>('')
  const [isExportingPdf, setIsExportingPdf] = useState(false)

  // Distinct list of event names from scores, challenges, and sessions
  const availableEvents = useMemo(() => {
    const eventSet = new Set<string>()
    scores.forEach((s) => {
      if (s.challengeTitle && s.challengeTitle.trim()) {
        eventSet.add(s.challengeTitle.trim())
      }
    })
    challenges.forEach((c) => {
      if (c.title && c.title.trim()) {
        eventSet.add(c.title.trim())
      }
    })
    sessions.forEach((s) => {
      if (s.challenge?.title) {
        eventSet.add(s.challenge.title.trim())
      }
    })
    return Array.from(eventSet).sort()
  }, [scores, challenges, sessions])

  // Combine official scores with all participants who joined session rooms
  const allParticipants = useMemo(() => {
    const list: LeaderboardParticipant[] = []
    const processedKeys = new Set<string>()

    // 1. Add all official scores first
    scores.forEach((s) => {
      const eventTitle = (s.challengeTitle || 'Cyber Mission').trim()
      const key = `${s.playerName.trim().toLowerCase()}__${eventTitle.toLowerCase()}`
      processedKeys.add(key)

      // Find matching session if available
      const sess = sessions.find(
        (sess) => (sess.challenge?.title || '').trim().toLowerCase() === eventTitle.toLowerCase()
      )
      const playerRecord = players.find(
        (p) => p.name.trim().toLowerCase() === s.playerName.trim().toLowerCase()
      )

      list.push({
        id: s.id,
        name: s.playerName,
        avatar: playerRecord?.avatar,
        eventTitle,
        joinCode: sess?.joinCode || playerRecord?.joinCode,
        status: 'solved',
        solveTime: s.timeTaken,
        score: s.score,
        attempts: s.attempts || 1,
        hintsRevealed: s.hintsRevealed || 0,
        completedAt: s.createdAt,
        isOfficialScore: true
      })
    })

    // 2. Add all contestants from session players who don't have an official score yet
    players.forEach((p) => {
      if (!p || !p.name) return
      const sess = sessions.find(
        (s) => s.id === p.sessionId || (s.joinCode && p.joinCode && s.joinCode.toUpperCase() === p.joinCode.toUpperCase())
      )
      const ch = sess?.challenge || challenges.find((c) => c.id === sess?.challengeId)
      const eventTitle = ch?.title || sess?.challenge?.title || (sess?.joinCode ? `Room ${sess.joinCode}` : 'Cyber Mission')
      const key = `${p.name.trim().toLowerCase()}__${eventTitle.trim().toLowerCase()}`

      if (!processedKeys.has(key)) {
        processedKeys.add(key)
        list.push({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          eventTitle,
          joinCode: p.joinCode || sess?.joinCode,
          status: p.status || 'waiting',
          solveTime: p.solveTime,
          score: p.score || 0,
          attempts: p.attempts || 0,
          hintsRevealed: p.revealedHints?.length || p.hintsUsed || 0,
          completedAt: p.joinedAt,
          isOfficialScore: false
        })
      }
    })

    return list
  }, [scores, players, sessions, challenges])

  // Count participants and solvers per event
  const eventCounts = useMemo(() => {
    const map: Record<string, { total: number; solved: number }> = {}
    allParticipants.forEach((p) => {
      const key = p.eventTitle.trim()
      if (!map[key]) map[key] = { total: 0, solved: 0 }
      map[key].total++
      if (p.status === 'solved') map[key].solved++
    })
    return map
  }, [allParticipants])

  // Filter and sort members based on event, status, and search query
  const filteredParticipants = useMemo(() => {
    return allParticipants
      .filter((p) => {
        const matchesEvent =
          selectedEvent === 'ALL' ||
          p.eventTitle.trim().toLowerCase() === selectedEvent.toLowerCase()
        const matchesStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'SOLVED' && p.status === 'solved') ||
          (statusFilter === 'ACTIVE' && p.status !== 'solved')
        const matchesSearch =
          !search.trim() ||
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.eventTitle.toLowerCase().includes(search.toLowerCase()) ||
          (p.joinCode && p.joinCode.toLowerCase().includes(search.toLowerCase()))
        return matchesEvent && matchesStatus && matchesSearch
      })
      .sort((a, b) => {
        // Solved members always rank above non-solved
        if (a.status === 'solved' && b.status !== 'solved') return -1
        if (b.status === 'solved' && a.status !== 'solved') return 1

        // For solved: higher score first, then faster solve time
        if (a.status === 'solved' && b.status === 'solved') {
          if (b.score !== a.score) return b.score - a.score
          const timeA = a.solveTime !== undefined && a.solveTime > 0 ? a.solveTime : 99999
          const timeB = b.solveTime !== undefined && b.solveTime > 0 ? b.solveTime : 99999
          return timeA - timeB
        }

        // For non-solved: playing first, then by attempts
        if (a.status === 'playing' && b.status !== 'playing') return -1
        if (b.status === 'playing' && a.status !== 'playing') return 1
        return (b.attempts || 0) - (a.attempts || 0)
      })
  }, [allParticipants, selectedEvent, statusFilter, search])

  // Event Statistics HUD calculation
  const stats = useMemo(() => {
    const solvers = filteredParticipants.filter((p) => p.status === 'solved')
    if (filteredParticipants.length === 0) return null

    const topBreacher = solvers[0]?.name || '—'
    const topScore = solvers[0]?.score || 0
    const validTimes = solvers.map((p) => p.solveTime).filter((t): t is number => t !== undefined && t > 0)
    const fastest = validTimes.length > 0 ? Math.min(...validTimes) : null
    const avgAttempts =
      Math.round((filteredParticipants.reduce((acc, p) => acc + (p.attempts || 0), 0) / filteredParticipants.length) * 10) / 10

    return {
      totalMembers: filteredParticipants.length,
      solvedCount: solvers.length,
      activeCount: filteredParticipants.length - solvers.length,
      topBreacher,
      topScore,
      fastest,
      avgAttempts
    }
  }, [filteredParticipants])

  // EXPORT EXCEL (.csv formatted with BOM for Microsoft Excel)
  const handleExportExcel = () => {
    sound.playClick()
    const eventName = selectedEvent === 'ALL' ? 'All_Events' : selectedEvent
    const headers = [
      'Rank',
      'Contestant Name',
      'Event / Mission',
      'Room PIN',
      'Status',
      'Score (pts)',
      'Solve Time (mm:ss)',
      'Solve Time (sec)',
      'Attempts',
      'Clues Used',
      'Date / Time'
    ]

    let rankCounter = 1
    const rows = filteredParticipants.map((p) => {
      const isSolved = p.status === 'solved'
      const rank = isSolved ? `${rankCounter++}` : '—'
      return [
        rank,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.eventTitle || '').replace(/"/g, '""')}"`,
        `"${(p.joinCode || '').replace(/"/g, '""')}"`,
        p.status.toUpperCase(),
        p.score || 0,
        formatSeconds(p.solveTime),
        p.solveTime ?? '',
        p.attempts || 0,
        p.hintsRevealed || 0,
        `"${p.completedAt ? new Date(p.completedAt).toLocaleString() : ''}"`
      ]
    })

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const cleanSlug = eventName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
    a.href = url
    a.download = `CrackVault_Leaderboard_${cleanSlug}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    onNotify?.('Excel (.csv) exported successfully!')
  }

  // EXPORT PDF via jsPDF & jspdf-autotable
  const handleExportPdf = async () => {
    sound.playClick()
    setIsExportingPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      })

      const eventName = selectedEvent === 'ALL' ? 'All Events' : selectedEvent

      // Header Banner
      doc.setFontSize(18)
      doc.setTextColor(15, 23, 42)
      doc.text('CRACKVAULT • EVENT LEADERBOARD REPORT', 40, 42)

      doc.setFontSize(10)
      doc.setTextColor(100, 116, 139)
      doc.text(
        `Event: ${eventName}  |  Generated: ${new Date().toLocaleString()}  |  Total Members: ${filteredParticipants.length}`,
        40,
        58
      )

      if (stats) {
        doc.setFontSize(9)
        doc.setTextColor(30, 41, 59)
        doc.text(
          `Solvers: ${stats.solvedCount}  •  Top Breacher: ${stats.topBreacher}  •  High Score: ${stats.topScore.toLocaleString()} pts  •  Fastest Time: ${formatSeconds(stats.fastest)}`,
          40,
          74
        )
      }

      let rankCounter = 1
      const head = [['Rank', 'Contestant', 'Event / Mission', 'Room PIN', 'Status', 'Solve Time', 'Attempts', 'Clues', 'Score']]
      const body = filteredParticipants.map((p) => [
        p.status === 'solved' ? `#${rankCounter++}` : '—',
        p.name,
        p.eventTitle,
        p.joinCode || '—',
        p.status.toUpperCase(),
        formatSeconds(p.solveTime),
        String(p.attempts || 0),
        String(p.hintsRevealed || 0),
        `${(p.score || 0).toLocaleString()} pts`
      ])

      autoTable(doc, {
        startY: stats ? 88 : 70,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [30, 41, 59]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        columnStyles: {
          0: { cellWidth: 45, halign: 'center' },
          4: { cellWidth: 65, halign: 'center' },
          5: { cellWidth: 65, halign: 'center' },
          6: { cellWidth: 50, halign: 'center' },
          7: { cellWidth: 45, halign: 'center' },
          8: { cellWidth: 70, halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: 40, right: 40 }
      })

      const cleanSlug = eventName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
      doc.save(`CrackVault_Leaderboard_${cleanSlug}_${new Date().toISOString().slice(0, 10)}.pdf`)
      onNotify?.('PDF report downloaded successfully!')
    } catch (err) {
      console.error('PDF export error:', err)
      onNotify?.('Failed to generate PDF')
    } finally {
      setIsExportingPdf(false)
    }
  }

  const handleClear = () => {
    if (confirm('Are you sure you want to purge all historical leaderboard entries?')) {
      onClearLeaderboard?.()
      sound.playClick()
      onNotify?.('Leaderboard wiped')
    }
  }

  let solverRankCounter = 1

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid var(--neon-amber)',
                color: 'var(--neon-amber)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Trophy size={16} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>Event Leaderboard Dashboard</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Multi-event standings showing all registered contestants, breach solvers, attempts, and live scores.
          </p>
        </div>

        {/* Action Controls: Export Excel & PDF, Clear Records */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            className="btn-secondary"
            onClick={handleExportExcel}
            style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.45rem', borderColor: 'rgba(0, 245, 160, 0.4)', color: 'var(--neon-mint)' }}
            title="Export full event standings to Microsoft Excel CSV"
          >
            <FileSpreadsheet size={15} /> Export Excel
          </button>

          <button
            className="btn-secondary"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.45rem', borderColor: 'rgba(0, 216, 246, 0.4)', color: 'var(--neon-cyan)' }}
            title="Generate and download official PDF leaderboard report"
          >
            <FileText size={15} /> {isExportingPdf ? 'Generating PDF...' : 'Export PDF'}
          </button>

          {scores.length > 0 && !readOnly && onClearLeaderboard && (
            <button className="btn-secondary" onClick={handleClear} style={{ color: 'var(--neon-crimson)', borderColor: 'rgba(255, 51, 102, 0.3)', fontSize: '0.82rem' }}>
              <Trash2 size={14} /> Clear Records
            </button>
          )}
        </div>
      </div>

      {/* Event Filter Selection Bar */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Flag size={14} style={{ color: 'var(--neon-cyan)' }} />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Select Event / Challenge
            </span>
          </div>

          {/* Member Status Filter */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(255,255,255,0.03)', padding: '0.2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setStatusFilter('ALL')}
              style={{
                background: statusFilter === 'ALL' ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none',
                color: statusFilter === 'ALL' ? '#fff' : 'var(--text-muted)',
                fontSize: '0.72rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              All Members ({allParticipants.length})
            </button>
            <button
              onClick={() => setStatusFilter('SOLVED')}
              style={{
                background: statusFilter === 'SOLVED' ? 'rgba(0, 245, 160, 0.15)' : 'transparent',
                border: 'none',
                color: statusFilter === 'SOLVED' ? 'var(--neon-mint)' : 'var(--text-muted)',
                fontSize: '0.72rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Breached Solvers ({allParticipants.filter((p) => p.status === 'solved').length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              style={{
                background: statusFilter === 'ACTIVE' ? 'rgba(0, 216, 246, 0.15)' : 'transparent',
                border: 'none',
                color: statusFilter === 'ACTIVE' ? 'var(--neon-cyan)' : 'var(--text-muted)',
                fontSize: '0.72rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              In Progress / Lobby ({allParticipants.filter((p) => p.status !== 'solved').length})
            </button>
          </div>
        </div>

        {/* Event Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => {
              setSelectedEvent('ALL')
              sound.playClick()
            }}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              border: selectedEvent === 'ALL' ? '1px solid var(--neon-mint)' : '1px solid var(--border-subtle)',
              background: selectedEvent === 'ALL' ? 'rgba(0, 245, 160, 0.12)' : 'rgba(255, 255, 255, 0.02)',
              color: selectedEvent === 'ALL' ? 'var(--neon-mint)' : 'var(--text-secondary)',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s ease'
            }}
          >
            <span>All Events</span>
            <span
              style={{
                fontSize: '0.68rem',
                background: selectedEvent === 'ALL' ? 'var(--neon-mint)' : 'rgba(255,255,255,0.08)',
                color: selectedEvent === 'ALL' ? '#080d1a' : 'var(--text-muted)',
                padding: '0.1rem 0.4rem',
                borderRadius: '10px',
                fontWeight: 800
              }}
            >
              {allParticipants.length}
            </span>
          </button>

          {availableEvents.map((evt) => {
            const counts = eventCounts[evt] || { total: 0, solved: 0 }
            const isSelected = selectedEvent.toLowerCase() === evt.toLowerCase()
            return (
              <button
                key={evt}
                onClick={() => {
                  setSelectedEvent(evt)
                  sound.playClick()
                }}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  border: isSelected ? '1px solid var(--neon-cyan)' : '1px solid var(--border-subtle)',
                  background: isSelected ? 'rgba(0, 216, 246, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  color: isSelected ? 'var(--neon-cyan)' : 'var(--text-secondary)',
                  fontSize: '0.82rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <Target size={13} />
                <span>{evt}</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    background: isSelected ? 'var(--neon-cyan)' : 'rgba(255,255,255,0.08)',
                    color: isSelected ? '#080d1a' : 'var(--text-muted)',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '10px',
                    fontWeight: 800
                  }}
                  title={`${counts.solved} solvers / ${counts.total} total members`}
                >
                  {counts.solved > 0 ? `${counts.solved}🏆 / ${counts.total}` : counts.total}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Event Performance HUD */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}
        >
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--neon-cyan)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
              Total Event Members
            </span>
            <strong style={{ fontSize: '1.25rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
              <Users size={16} style={{ color: 'var(--neon-cyan)' }} />
              {stats.totalMembers} Enrolled
            </strong>
          </div>

          <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--neon-mint)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
              Vault Breaches
            </span>
            <strong style={{ fontSize: '1.25rem', color: 'var(--neon-mint)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
              <CheckCircle size={16} style={{ color: 'var(--neon-mint)' }} />
              {stats.solvedCount} Solved
            </strong>
          </div>

          <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--neon-amber)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
              Top Breacher
            </span>
            <strong style={{ fontSize: '1.15rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
              <Award size={16} style={{ color: 'var(--neon-amber)' }} />
              {stats.topBreacher}
            </strong>
          </div>

          <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--neon-mint)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
              High Score
            </span>
            <strong style={{ fontSize: '1.25rem', color: 'var(--neon-mint)', fontFamily: 'var(--font-mono)', display: 'block', marginTop: '0.2rem' }}>
              {stats.topScore > 0 ? `${stats.topScore.toLocaleString()} pts` : '—'}
            </strong>
          </div>

          <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--neon-violet)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>
              Fastest Solve
            </span>
            <strong style={{ fontSize: '1.25rem', color: 'var(--neon-cyan)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
              <Clock size={16} />
              {formatSeconds(stats.fastest)}
            </strong>
          </div>
        </div>
      )}

      {/* Search Filter */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          className="input-field"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${selectedEvent === 'ALL' ? 'all event members' : selectedEvent} by contestant alias, mission, or room PIN...`}
          style={{ border: 'none', background: 'transparent', padding: '0.25rem', width: '100%' }}
        />
        {search && (
          <button
            className="btn-secondary"
            onClick={() => setSearch('')}
            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* All Members Standings Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '0.85rem 1.25rem', width: '70px' }}>Rank</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Contestant</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Event / Mission</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Status</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Solve Time</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Attempts</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Clues</th>
              <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {filteredParticipants.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Users size={32} style={{ color: 'var(--text-muted)', opacity: 0.5, margin: '0 auto 0.75rem' }} />
                  <div style={{ fontSize: '1rem', color: '#cbd5e1', marginBottom: '0.25rem', fontWeight: 600 }}>
                    {selectedEvent === 'ALL'
                      ? 'No Contestants Enrolled In Any Event'
                      : `No Members Enrolled In "${selectedEvent}"`}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Launch a live room in Mission Control and invite contestants to join via PIN or direct link.
                  </span>
                </td>
              </tr>
            ) : (
              filteredParticipants.map((p) => {
                const isSolved = p.status === 'solved'
                const rankNum = isSolved ? solverRankCounter++ : null

                return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: rankNum === 1 ? 'rgba(245, 158, 11, 0.04)' : undefined
                    }}
                  >
                    {/* Rank */}
                    <td style={{ padding: '0.85rem 1.25rem', fontFamily: 'var(--font-mono)' }}>
                      {rankNum === 1 ? (
                        <span className="badge badge-amber" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>
                          🥇 #1
                        </span>
                      ) : rankNum === 2 ? (
                        <span className="badge" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1' }}>
                          🥈 #2
                        </span>
                      ) : rankNum === 3 ? (
                        <span className="badge" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: 'rgba(217, 119, 6, 0.2)', color: '#fbbf24' }}>
                          🥉 #3
                        </span>
                      ) : rankNum !== null ? (
                        <span style={{ color: 'var(--text-muted)', paddingLeft: '0.35rem' }}>#{rankNum}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', paddingLeft: '0.35rem' }}>—</span>
                      )}
                    </td>

                    {/* Contestant */}
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        {p.avatar && <span style={{ fontSize: '1rem' }}>{p.avatar}</span>}
                        <strong style={{ color: '#fff' }}>{p.name}</strong>
                      </div>
                    </td>

                    {/* Event / Mission */}
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <span className="badge badge-cyan" style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}>
                          {p.eventTitle}
                        </span>
                        {p.joinCode && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            PIN: {p.joinCode}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      {p.status === 'solved' && (
                        <span className="badge badge-mint" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                          ✓ SOLVED
                        </span>
                      )}
                      {p.status === 'playing' && (
                        <span className="badge badge-cyan" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                          <span className="pulse-dot" style={{ width: '5px', height: '5px', marginRight: '4px' }} />
                          PLAYING
                        </span>
                      )}
                      {p.status === 'waiting' && (
                        <span className="badge badge-amber" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                          LOBBY
                        </span>
                      )}
                      {p.status === 'failed' && (
                        <span className="badge badge-crimson" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                          TIMEOUT
                        </span>
                      )}
                    </td>

                    {/* Solve Time */}
                    <td style={{ padding: '0.85rem 1.25rem', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: p.solveTime ? 'var(--neon-cyan)' : 'var(--text-muted)' }}>
                        {p.solveTime ? <Clock size={13} style={{ color: 'var(--neon-cyan)' }} /> : null}
                        {formatSeconds(p.solveTime)}
                      </span>
                    </td>

                    {/* Attempts */}
                    <td style={{ padding: '0.85rem 1.25rem', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Zap size={12} style={{ color: 'var(--text-muted)' }} /> {p.attempts}
                      </span>
                    </td>

                    {/* Clues */}
                    <td style={{ padding: '0.85rem 1.25rem', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Eye size={12} style={{ color: 'var(--text-muted)' }} /> {p.hintsRevealed}
                      </span>
                    </td>

                    {/* Final Score */}
                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: p.score > 0 ? 'var(--neon-mint)' : 'var(--text-muted)', fontSize: '1rem' }}>
                      {p.score > 0 ? `${p.score.toLocaleString()} pts` : '0 pts'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
