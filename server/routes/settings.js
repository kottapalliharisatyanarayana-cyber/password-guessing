import express from 'express'
import { Settings } from '../models/Settings.js'

const router = express.Router()

const DEFAULT_SETTINGS = {
  id: 'global_settings',
  adminUsername: 'admin',
  adminPassword: 'admin123',
  defaultTimeLimit: 300,
  soundEnabled: true
}

let memorySettings = { ...DEFAULT_SETTINGS }

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    let settings = await Settings.findOne({ id: 'global_settings' })
    if (!settings) {
      settings = await Settings.create(DEFAULT_SETTINGS)
    }
    memorySettings = settings.toObject ? settings.toObject() : settings
    return res.json(memorySettings)
  } catch (err) {
    console.warn('⚠️ [Settings API] MongoDB read error, serving from memory:', err.message)
    return res.json(memorySettings)
  }
})

// POST /api/settings
router.post('/', async (req, res) => {
  const data = req.body || {}
  memorySettings = { ...memorySettings, ...data, id: 'global_settings' }

  try {
    const settings = await Settings.findOneAndUpdate(
      { id: 'global_settings' },
      { $set: memorySettings },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )
    return res.json(settings)
  } catch (err) {
    console.warn('⚠️ [Settings API] MongoDB save error, served from memory:', err.message)
    return res.json(memorySettings)
  }
})

export default router
