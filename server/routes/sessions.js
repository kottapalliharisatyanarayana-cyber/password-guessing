import express from 'express'
import { Session } from '../models/Session.js'

const router = express.Router()

// Resilient in-memory fallback cache in case MongoDB Atlas is pending IP whitelist
const memorySessions = new Map()

// GET /api/sessions - list sessions
router.get('/', async (req, res) => {
  try {
    const query = req.query.status ? { status: req.query.status } : {}
    const sessions = await Session.find(query).sort({ updatedAt: -1 }).limit(100)
    // Update memory cache
    sessions.forEach((s) => memorySessions.set(s.id, s.toObject ? s.toObject() : s))
    return res.json(sessions)
  } catch (err) {
    console.warn('⚠️ [Sessions API] MongoDB read error, serving from memory cache:', err.message)
    const all = Array.from(memorySessions.values())
    if (req.query.status) {
      return res.json(all.filter((s) => s.status === req.query.status))
    }
    return res.json(all)
  }
})

// GET /api/sessions/code/:joinCode - find active session by PIN code
router.get('/code/:joinCode', async (req, res) => {
  const cleanCode = req.params.joinCode.trim().toUpperCase()
  try {
    const session =
      (await Session.findOne({ joinCode: cleanCode, status: { $ne: 'ended' } })) ||
      (await Session.findOne({ joinCode: cleanCode }))

    if (session) {
      memorySessions.set(session.id, session.toObject ? session.toObject() : session)
      return res.json(session)
    }
  } catch (err) {
    console.warn('⚠️ [Sessions API] MongoDB findOne error, falling back to memory:', err.message)
  }

  // Fallback to memory
  const memSession =
    Array.from(memorySessions.values()).find(
      (s) => s.joinCode && s.joinCode.toUpperCase() === cleanCode && s.status !== 'ended'
    ) ||
    Array.from(memorySessions.values()).find(
      (s) => s.joinCode && s.joinCode.toUpperCase() === cleanCode
    )

  if (memSession) {
    return res.json(memSession)
  }

  return res.status(404).json({ error: `Session not found for code ${cleanCode}` })
})

// GET /api/sessions/:id - get session by ID
router.get('/:id', async (req, res) => {
  try {
    const session = await Session.findOne({ id: req.params.id })
    if (session) {
      return res.json(session)
    }
  } catch (err) {
    console.warn('⚠️ [Sessions API] MongoDB findById error:', err.message)
  }

  const memSession = memorySessions.get(req.params.id)
  if (memSession) return res.json(memSession)

  return res.status(404).json({ error: 'Session not found' })
})

// POST /api/sessions - create or upsert session
router.post('/', async (req, res) => {
  const data = req.body
  if (!data.id || !data.joinCode) {
    return res.status(400).json({ error: 'Session id and joinCode are required' })
  }

  // Always update in-memory immediately
  memorySessions.set(data.id, data)

  // Persist to MongoDB Atlas asynchronously
  try {
    const session = await Session.findOneAndUpdate(
      { id: data.id },
      { $set: data },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )
    return res.status(200).json(session)
  } catch (err) {
    console.warn('⚠️ [Sessions API] MongoDB save error (will serve from memory):', err.message)
    return res.status(200).json(data)
  }
})

// POST /api/sessions/batch - bulk sync sessions from client
router.post('/batch', async (req, res) => {
  const sessions = req.body
  if (!Array.isArray(sessions)) {
    return res.status(400).json({ error: 'Expected an array of sessions' })
  }

  sessions.forEach((s) => {
    if (s.id) memorySessions.set(s.id, s)
  })

  try {
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
    return res.json(current)
  } catch (err) {
    console.warn('⚠️ [Sessions API] MongoDB bulkWrite error:', err.message)
    return res.json(Array.from(memorySessions.values()))
  }
})

// PATCH /api/sessions/:id - partial update (e.g. status, timer, winner)
router.patch('/:id', async (req, res) => {
  const existing = memorySessions.get(req.params.id) || {}
  const updated = { ...existing, ...req.body }
  memorySessions.set(req.params.id, updated)

  try {
    const session = await Session.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { returnDocument: 'after' }
    )
    if (session) return res.json(session)
  } catch (err) {
    console.warn('⚠️ [Sessions API] MongoDB patch error:', err.message)
  }

  return res.json(updated)
})

// DELETE /api/sessions/:id - remove session
router.delete('/:id', async (req, res) => {
  memorySessions.delete(req.params.id)
  try {
    await Session.deleteOne({ id: req.params.id })
  } catch (err) {
    console.warn('⚠️ [Sessions API] MongoDB delete error:', err.message)
  }
  return res.json({ success: true, id: req.params.id })
})

export default router
