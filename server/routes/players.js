import express from 'express'
import { Player } from '../models/Player.js'

const router = express.Router()
const memoryPlayers = new Map()

// GET /api/players
router.get('/', async (req, res) => {
  try {
    const filter = {}
    if (req.query.sessionId) filter.sessionId = req.query.sessionId
    if (req.query.joinCode) filter.joinCode = req.query.joinCode.toUpperCase()
    const players = await Player.find(filter).sort({ score: -1, solveTime: 1 })
    players.forEach((p) => memoryPlayers.set(p.id, p.toObject ? p.toObject() : p))
    return res.json(players)
  } catch (err) {
    console.warn('⚠️ [Players API] MongoDB read error, serving from memory:', err.message)
    let all = Array.from(memoryPlayers.values())
    if (req.query.sessionId) all = all.filter((p) => p.sessionId === req.query.sessionId)
    if (req.query.joinCode) {
      all = all.filter(
        (p) => p.joinCode && p.joinCode.toUpperCase() === req.query.joinCode.toUpperCase()
      )
    }
    return res.json(all)
  }
})

// POST /api/players
router.post('/', async (req, res) => {
  const data = req.body
  if (!data.id || !data.name) {
    return res.status(400).json({ error: 'Player id and name are required' })
  }

  memoryPlayers.set(data.id, data)

  try {
    const player = await Player.findOneAndUpdate(
      { id: data.id },
      { $set: data },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )
    return res.json(player)
  } catch (err) {
    console.warn('⚠️ [Players API] MongoDB save error, served from memory:', err.message)
    return res.json(data)
  }
})

// POST /api/players/batch
router.post('/batch', async (req, res) => {
  const players = req.body
  if (!Array.isArray(players)) {
    return res.status(400).json({ error: 'Expected an array of players' })
  }

  players.forEach((p) => {
    if (p.id) memoryPlayers.set(p.id, p)
  })

  try {
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
    return res.json(all)
  } catch (err) {
    console.warn('⚠️ [Players API] MongoDB bulkWrite error:', err.message)
    return res.json(Array.from(memoryPlayers.values()))
  }
})

// DELETE /api/players/:id
router.delete('/:id', async (req, res) => {
  memoryPlayers.delete(req.params.id)
  try {
    await Player.deleteOne({ id: req.params.id })
  } catch (err) {
    console.warn('⚠️ [Players API] MongoDB delete error:', err.message)
  }
  return res.json({ success: true, id: req.params.id })
})

export default router
