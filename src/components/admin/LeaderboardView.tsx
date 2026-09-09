import React, { useState } from 'react'
import { ScoreEntry } from '../../types'
import { sound } from '../../lib/sound'
import { Trophy, Medal, Award, Clock, Zap, Eye, Search, Trash2 } from 'lucide-react'

interface LeaderboardViewProps {
  scores: ScoreEntry[]
  onClearLeaderboard: () => void
  onNotify: (msg: string) => void
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  scores,
  onClearLeaderboard,
  onNotify
}) => {
  const [search, setSearch] = useState('')

  const sorted = [...scores].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const timeA = a.timeTaken !== undefined && a.timeTaken > 0 ? a.timeTaken : 99999
    const timeB = b.timeTaken !== undefined && b.timeTaken > 0 ? b.timeTaken : 99999
    return timeA - timeB
  })
  const filtered = sorted.filter(
    (s) =>
      s.playerName.toLowerCase().includes(search.toLowerCase()) ||
      s.challengeTitle.toLowerCase().includes(search.toLowerCase())
  )

  const top1 = sorted[0]
  const top2 = sorted[1]
  const top3 = sorted[2]

  const handleClear = () => {
    if (confirm('Are you sure you want to purge all historical leaderboard entries?')) {
      onClearLeaderboard()
      sound.playClick()
      onNotify('Leaderboard wiped')
    }
  }

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff' }}>Hall of Fame &amp; Global Standings</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Verified vault breach records ranked by mathematical speed and accuracy score.
          </p>
        </div>

        {scores.length > 0 && (
          <button className="btn-secondary" onClick={handleClear} style={{ color: 'var(--neon-crimson)', borderColor: 'rgba(255, 51, 102, 0.3)' }}>
            <Trash2 size={15} /> Clear Records
          </button>
        )}
      </div>

      {/* Top 3 Podium Cards */}
      {sorted.length >= 3 && (
        <div className="podium-container">
          {/* 2nd Place */}
          <div className="podium-card podium-2">
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', fontWeight: 800 }}>
              <Medal size={22} />
            </div>
            <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', marginBottom: '0.5rem' }}>
              RANK #2
            </span>
            <strong style={{ fontSize: '1.15rem', color: '#fff', display: 'block', marginBottom: '0.2rem' }}>
              {top2.playerName}
            </strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              {top2.challengeTitle}
            </span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: '#e2e8f0' }}>
              {top2.score.toLocaleString()} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>pts</span>
            </div>
          </div>

          {/* 1st Place Champion */}
          <div className="podium-card podium-1">
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.25)', border: '1px solid var(--neon-amber)', color: 'var(--neon-amber)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', boxShadow: '0 0 24px rgba(245, 158, 11, 0.4)' }}>
              <Trophy size={28} />
            </div>
            <span className="badge badge-amber" style={{ marginBottom: '0.5rem' }}>
              CHAMPION #1
            </span>
            <strong style={{ fontSize: '1.35rem', color: '#fff', display: 'block', marginBottom: '0.25rem' }}>
              {top1.playerName}
            </strong>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              {top1.challengeTitle}
            </span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900, color: 'var(--neon-mint)', textShadow: '0 0 16px rgba(0, 245, 160, 0.4)' }}>
              {top1.score.toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>pts</span>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="podium-card podium-3">
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(217, 119, 6, 0.2)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', fontWeight: 800 }}>
              <Award size={22} />
            </div>
            <span className="badge" style={{ background: 'rgba(217, 119, 6, 0.15)', color: '#fbbf24', marginBottom: '0.5rem' }}>
              RANK #3
            </span>
            <strong style={{ fontSize: '1.15rem', color: '#fff', display: 'block', marginBottom: '0.2rem' }}>
              {top3.playerName}
            </strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              {top3.challengeTitle}
            </span>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: '#e2e8f0' }}>
              {top3.score.toLocaleString()} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>pts</span>
            </div>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="glass-panel" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Search size={16} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          className="input-field"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter standings by contestant alias or challenge title..."
          style={{ border: 'none', background: 'transparent', padding: '0.25rem' }}
        />
      </div>

      {/* Standings Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '0.85rem 1.25rem', width: '80px' }}>Rank</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Contestant</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Challenge</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Attempts</th>
              <th style={{ padding: '0.85rem 1.25rem' }}>Clues</th>
              <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No scores recorded yet. Compete in a game to appear on the leaderboard!
                </td>
              </tr>
            ) : (
              filtered.map((entry, idx) => (
                <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '0.85rem 1.25rem', fontFamily: 'var(--font-mono)' }}>
                    {idx === 0 ? '🥇 01' : idx === 1 ? '🥈 02' : idx === 2 ? '🥉 03' : `#${idx + 1}`}
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem', fontWeight: 700, color: '#fff' }}>
                    {entry.playerName}
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)' }}>
                    {entry.challengeTitle}
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Zap size={12} style={{ color: 'var(--text-muted)' }} /> {entry.attempts}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Eye size={12} style={{ color: 'var(--text-muted)' }} /> {entry.hintsRevealed}
                    </span>
                  </td>
                  <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--neon-mint)', fontSize: '1rem' }}>
                    {entry.score.toLocaleString()} pts
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
