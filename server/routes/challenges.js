import express from 'express'
import { Challenge } from '../models/Challenge.js'
import { Session } from '../models/Session.js'

const router = express.Router()
const memoryChallenges = new Map()

// GET /api/challenges
router.get('/', async (req, res) => {
  try {
    const challenges = await Challenge.find().sort({ createdAt: -1 })
    memoryChallenges.clear()
    challenges.forEach((c) => memoryChallenges.set(c.id, c.toObject ? c.toObject() : c))
    return res.json(challenges)
  } catch (err) {
    console.warn('⚠️ [Challenges API] MongoDB read error, serving from memory:', err.message)
    return res.json(Array.from(memoryChallenges.values()))
  }
})

// POST /api/challenges
router.post('/', async (req, res) => {
  const data = req.body
  if (!data.id || !data.title || !data.password) {
    return res.status(400).json({ error: 'Challenge id, title, and password are required' })
  }

  memoryChallenges.set(data.id, data)

  try {
    const challenge = await Challenge.findOneAndUpdate(
      { id: data.id },
      { $set: data },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
    return res.json(challenge || data)
  } catch (err) {
    console.warn('⚠️ [Challenges API] MongoDB save error, served from memory:', err.message)
    return res.json(data)
  }
})

// POST /api/challenges/batch
router.post('/batch', async (req, res) => {
  const challenges = req.body
  if (!Array.isArray(challenges)) {
    return res.status(400).json({ error: 'Expected an array of challenges' })
  }

  challenges.forEach((c) => {
    if (c.id) memoryChallenges.set(c.id, c)
  })

  try {
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
    return res.json(all)
  } catch (err) {
    console.warn('⚠️ [Challenges API] MongoDB bulkWrite error:', err.message)
    return res.json(Array.from(memoryChallenges.values()))
  }
})

// DELETE /api/challenges/all - clear all challenges
router.delete('/all', async (req, res) => {
  memoryChallenges.clear()
  try {
    await Challenge.deleteMany({})
    return res.json({ success: true, message: 'All challenges deleted from MongoDB' })
  } catch (err) {
    console.warn('⚠️ [Challenges API] MongoDB delete error:', err.message)
    return res.status(500).json({ error: err.message })
  }
})

// DELETE /api/challenges/:id
router.delete('/:id', async (req, res) => {
  const challengeId = req.params.id
  memoryChallenges.delete(challengeId)
  try {
    const deleteFilters = [{ id: challengeId }]
    if (challengeId.length === 24 && /^[0-9a-fA-F]{24}$/.test(challengeId)) {
      deleteFilters.push({ _id: challengeId })
    }
    await Promise.all([
      Challenge.deleteMany({ $or: deleteFilters }),
      Session.deleteMany({ challengeId })
    ])
  } catch (err) {
    console.warn('⚠️ [Challenges API] MongoDB delete error:', err.message)
  }
  return res.json({ success: true, id: challengeId })
})

export default router
