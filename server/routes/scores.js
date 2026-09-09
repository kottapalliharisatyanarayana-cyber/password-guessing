import express from 'express'
import { Score } from '../models/Score.js'

const router = express.Router()
const memoryScores = new Map()

// GET /api/scores
router.get('/', async (req, res) => {
  try {
    const filter = req.query.sessionId ? { sessionId: req.query.sessionId } : {}
    const scores = await Score.find(filter).sort({ score: -1, solveTime: 1 }).limit(100)
    scores.forEach((s) => memoryScores.set(s.id, s.toObject ? s.toObject() : s))
    return res.json(scores)
  } catch (err) {
    console.warn('⚠️ [Scores API] MongoDB read error, serving from memory:', err.message)
    let all = Array.from(memoryScores.values()).sort((a, b) => (b.score || 0) - (a.score || 0))
    if (req.query.sessionId) all = all.filter((s) => s.sessionId === req.query.sessionId)
    return res.json(all)
  }
})

// POST /api/scores
router.post('/', async (req, res) => {
  const data = req.body
  if (!data.id || !data.playerName) {
    return res.status(400).json({ error: 'Score id and playerName are required' })
  }

  const normalized = {
    ...data,
    sessionId: data.sessionId || 'global',
    timeTaken: data.timeTaken ?? data.solveTime ?? 0,
    solveTime: data.solveTime ?? data.timeTaken ?? 0,
    hintsRevealed: data.hintsRevealed ?? data.hintsUsed ?? 0,
    hintsUsed: data.hintsUsed ?? data.hintsRevealed ?? 0
  }

  memoryScores.set(normalized.id, normalized)

  try {
    const score = await Score.findOneAndUpdate(
      { id: normalized.id },
      { $set: normalized },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )
    return res.json(score)
  } catch (err) {
    console.warn('⚠️ [Scores API] MongoDB save error, served from memory:', err.message)
    return res.json(normalized)
  }
})

// POST /api/scores/batch
router.post('/batch', async (req, res) => {
  const scores = req.body
  if (!Array.isArray(scores)) {
    return res.status(400).json({ error: 'Expected an array of scores' })
  }

  scores.forEach((s) => {
    if (s.id) {
      const norm = {
        ...s,
        sessionId: s.sessionId || 'global',
        timeTaken: s.timeTaken ?? s.solveTime ?? 0,
        solveTime: s.solveTime ?? s.timeTaken ?? 0,
        hintsRevealed: s.hintsRevealed ?? s.hintsUsed ?? 0,
        hintsUsed: s.hintsUsed ?? s.hintsRevealed ?? 0
      }
      memoryScores.set(s.id, norm)
    }
  })

  try {
    const ops = scores.map((s) => {
      const norm = {
        ...s,
        sessionId: s.sessionId || 'global',
        timeTaken: s.timeTaken ?? s.solveTime ?? 0,
        solveTime: s.solveTime ?? s.timeTaken ?? 0,
        hintsRevealed: s.hintsRevealed ?? s.hintsUsed ?? 0,
        hintsUsed: s.hintsUsed ?? s.hintsRevealed ?? 0
      }
      return {
        updateOne: {
          filter: { id: norm.id },
          update: { $set: norm },
          upsert: true
        }
      }
    })

    if (ops.length > 0) {
      await Score.bulkWrite(ops)
    }

    const all = await Score.find().sort({ score: -1, solveTime: 1 }).limit(100)
    return res.json(all)
  } catch (err) {
    console.warn('⚠️ [Scores API] MongoDB bulkWrite error:', err.message)
    return res.json(Array.from(memoryScores.values()))
  }
})

// DELETE /api/scores/all - clear all scores
router.delete('/all', async (req, res) => {
  memoryScores.clear()
  try {
    await Score.deleteMany({})
    return res.json({ success: true, message: 'All scores deleted from MongoDB' })
  } catch (err) {
    console.warn('⚠️ [Scores API] MongoDB delete error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// DELETE /api/scores/:id
router.delete('/:id', async (req, res) => {
  memoryScores.delete(req.params.id)
  try {
    await Score.deleteOne({ id: req.params.id })
  } catch (err) {
    console.warn('⚠️ [Scores API] MongoDB delete error:', err.message)
  }
  return res.json({ success: true, id: req.params.id })
})

export default router
