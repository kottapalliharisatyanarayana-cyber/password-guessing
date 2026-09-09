import express from 'express'
import { Player } from '../models/Player.js'

const router = express.Router()

// GET /api/players - list players, optionally filtered by sessionId
router.get('/', async (req, res) => {
  try {
    const filter = {}
    if (req.query.sessionId) filter.sessionId = req.query.sessionId
    if (req.query.joinCode) filter.joinCode = req.query.joinCode.toUpperCase()
    const players = await Player.find(filter).sort({ score: -1, solveTime: 1 })
    res.json(players)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/players - upsert a player (e.g. join or status change)
router.post('/', async (req, res) => {
  try {
    const data = req.body
    if (!data.id || !data.name) {
      return res.status(400).json({ error: 'Player id and name are required' })
    }

    const player = await Player.findOneAndUpdate(
      { id: data.id },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    res.json(player)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/players/batch - bulk sync players
router.post('/batch', async (req, res) => {
  try {
    const players = req.body
    if (!Array.isArray(players)) {
      return res.status(400).json({ error: 'Expected an array of players' })
    }

    const ops = players.map((p) => ({
      updateOne: {
        filter: { id: p.id },
        update: { $set: p },
        upsert: true
      }
    }))

    if (ops.length > 0) {
      await Player.bulkWrite(ops)
    }

    const all = await Player.find()
    res.json(all)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/players/:id
router.delete('/:id', async (req, res) => {
  try {
    await Player.deleteOne({ id: req.params.id })
    res.json({ success: true, id: req.params.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
