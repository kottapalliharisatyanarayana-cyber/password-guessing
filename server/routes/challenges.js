import express from 'express'
import { Challenge } from '../models/Challenge.js'

const router = express.Router()

// GET /api/challenges - list challenges
router.get('/', async (req, res) => {
  try {
    const challenges = await Challenge.find().sort({ createdAt: -1 })
    res.json(challenges)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/challenges - upsert a challenge
router.post('/', async (req, res) => {
  try {
    const data = req.body
    if (!data.id || !data.title || !data.password) {
      return res.status(400).json({ error: 'Challenge id, title, and password are required' })
    }

    const challenge = await Challenge.findOneAndUpdate(
      { id: data.id },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    res.json(challenge)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/challenges/batch - bulk sync challenges
router.post('/batch', async (req, res) => {
  try {
    const challenges = req.body
    if (!Array.isArray(challenges)) {
      return res.status(400).json({ error: 'Expected an array of challenges' })
    }

    const ops = challenges.map((c) => ({
      updateOne: {
        filter: { id: c.id },
        update: { $set: c },
        upsert: true
      }
    }))

    if (ops.length > 0) {
      await Challenge.bulkWrite(ops)
    }

    const all = await Challenge.find().sort({ createdAt: -1 })
    res.json(all)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/challenges/:id
router.delete('/:id', async (req, res) => {
  try {
    await Challenge.deleteOne({ id: req.params.id })
    res.json({ success: true, id: req.params.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
