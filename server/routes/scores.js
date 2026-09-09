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
  if (!data.id || !data.sessionId || !data.playerName) {
    return res.status(400).json({ error: 'Score id, sessionId, and playerName are required' })
  }

  memoryScores.set(data.id, data)

  try {
    const score = await Score.findOneAndUpdate(
      { id: data.id },
      { $set: data },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )
    return res.json(score)
  } catch (err) {
    console.warn('⚠️ [Scores API] MongoDB save error, served from memory:', err.message)
    return res.json(data)
  }
})

// POST /api/scores/batch
router.post('/batch', async (req, res) => {
  const scores = req.body
  if (!Array.isArray(scores)) {
    return res.status(400).json({ error: 'Expected an array of scores' })
  }

  scores.forEach((s) => {
    if (s.id) memoryScores.set(s.id, s)
  })

  try {
    const ops = scores.map((s) => ({
      updateOne: {
        filter: { id: s.id },
        update: { $set: s },
        upsert: true
      }
    }))

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

export default router
