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
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
    return res.json(settings || memorySettings)
  } catch (err) {
    console.warn('⚠️ [Settings API] MongoDB save error, served from memory:', err.message)
    return res.json(memorySettings)
  }
})

// POST /api/settings/create-admin - explicitly create or reset admin credentials
router.post('/create-admin', async (req, res) => {
  const { adminUsername, adminPassword } = req.body || {}
  const username = (adminUsername || 'admin').trim()
  const password = (adminPassword || 'admin123').trim()

  memorySettings = {
    ...memorySettings,
    adminUsername: username,
    adminPassword: password,
    id: 'global_settings'
  }

  try {
    const settings = await Settings.findOneAndUpdate(
      { id: 'global_settings' },
      { $set: { adminUsername: username, adminPassword: password } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
    console.log(`🔑 [Settings API] Admin created/updated in MongoDB Atlas: "${username}"`)
    return res.json(settings || memorySettings)
  } catch (err) {
    console.warn('⚠️ [Settings API] Error creating admin in MongoDB:', err.message)
    return res.json(memorySettings)
  }
})

export default router
