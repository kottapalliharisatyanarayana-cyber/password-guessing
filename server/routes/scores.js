import express from 'express'
import { Score } from '../models/Score.js'

const router = express.Router()

// GET /api/scores - list scores
router.get('/', async (req, res) => {
  try {
    const filter = req.query.sessionId ? { sessionId: req.query.sessionId } : {}
    const scores = await Score.find(filter).sort({ score: -1, solveTime: 1 }).limit(100)
    res.json(scores)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/scores - record score
router.post('/', async (req, res) => {
  try {
    const data = req.body
    if (!data.id || !data.sessionId || !data.playerName) {
      return res.status(400).json({ error: 'Score id, sessionId, and playerName are required' })
    }

    const score = await Score.findOneAndUpdate(
      { id: data.id },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    res.json(score)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/scores/batch - bulk sync scores
router.post('/batch', async (req, res) => {
  try {
    const scores = req.body
    if (!Array.isArray(scores)) {
      return res.status(400).json({ error: 'Expected an array of scores' })
    }

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
    res.json(all)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
