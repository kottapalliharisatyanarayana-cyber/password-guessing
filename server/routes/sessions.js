import express from 'express'
import { Session } from '../models/Session.js'

const router = express.Router()

// GET /api/sessions - list sessions
router.get('/', async (req, res) => {
  try {
    const query = req.query.status ? { status: req.query.status } : {}
    const sessions = await Session.find(query).sort({ updatedAt: -1 }).limit(100)
    res.json(sessions)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/sessions/code/:joinCode - find active session by PIN code
router.get('/code/:joinCode', async (req, res) => {
  try {
    const cleanCode = req.params.joinCode.trim().toUpperCase()
    const session = await Session.findOne({
      joinCode: cleanCode,
      status: { $ne: 'ended' }
    }) || await Session.findOne({ joinCode: cleanCode })

    if (!session) {
      return res.status(404).json({ error: `Session not found for code ${cleanCode}` })
    }
    res.json(session)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/sessions/:id - get session by ID
router.get('/:id', async (req, res) => {
  try {
    const session = await Session.findOne({ id: req.params.id })
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    res.json(session)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/sessions - create or upsert session
router.post('/', async (req, res) => {
  try {
    const data = req.body
    if (!data.id || !data.joinCode) {
      return res.status(400).json({ error: 'Session id and joinCode are required' })
    }

    const session = await Session.findOneAndUpdate(
      { id: data.id },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )
    res.status(200).json(session)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/sessions/batch - bulk sync sessions from client
router.post('/batch', async (req, res) => {
  try {
    const sessions = req.body
    if (!Array.isArray(sessions)) {
      return res.status(400).json({ error: 'Expected an array of sessions' })
    }

    const ops = sessions.map((s) => ({
      updateOne: {
        filter: { id: s.id },
        update: { $set: s },
        upsert: true
      }
    }))

    if (ops.length > 0) {
      await Session.bulkWrite(ops)
    }

    const current = await Session.find().sort({ updatedAt: -1 }).limit(100)
    res.json(current)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/sessions/:id - partial update (e.g. status, timer, winner)
router.patch('/:id', async (req, res) => {
  try {
    const session = await Session.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    )
    if (!session) {
      return res.status(404).json({ error: 'Session not found' })
    }
    res.json(session)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/sessions/:id - remove session
router.delete('/:id', async (req, res) => {
  try {
    await Session.deleteOne({ id: req.params.id })
    res.json({ success: true, id: req.params.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
