import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import dns from 'dns'

import sessionsRouter from './routes/sessions.js'
import playersRouter from './routes/players.js'
import challengesRouter from './routes/challenges.js'
import scoresRouter from './routes/scores.js'
import settingsRouter from './routes/settings.js'

import { Session } from './models/Session.js'
import { Player } from './models/Player.js'
import { Challenge } from './models/Challenge.js'
import { Score } from './models/Score.js'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Configure reliable DNS servers for MongoDB SRV resolution
try {
  dns.setServers(['8.8.8.8', '1.1.1.1'])
} catch {
  // Ignore if permissions disallow setting custom DNS
}

// Fallback URI if environment variable is missing (e.g. Vercel deployment before dashboard setup)
const DEFAULT_MONGODB_URI =
  'mongodb+srv://kottapalliharisatyanarayana_db_user:T4h3OeE5WqHM4Mmw@cluster0.18sjvym.mongodb.net/crackvault?retryWrites=true&w=majority'

// Automatically sanitize MongoDB URI (removes < > brackets and encodes special chars in password)
function formatMongoUri(rawUri) {
  if (!rawUri) return DEFAULT_MONGODB_URI
  let uri = rawUri.trim()
  uri = uri.replace(/<([^>]+)>/g, '$1')

  const atIndex = uri.lastIndexOf('@')
  if (atIndex !== -1) {
    const prefixAndAuth = uri.substring(0, atIndex)
    const hostAndQuery = uri.substring(atIndex + 1)
    const colonIndex = prefixAndAuth.indexOf('://')
    if (colonIndex !== -1) {
      const scheme = prefixAndAuth.substring(0, colonIndex + 3)
      const userAndPass = prefixAndAuth.substring(colonIndex + 3)
      const firstColon = userAndPass.indexOf(':')
      if (firstColon !== -1) {
        const username = userAndPass.substring(0, firstColon)
        const password = userAndPass.substring(firstColon + 1)
        const encodedPass = encodeURIComponent(decodeURIComponent(password))
        uri = `${scheme}${username}:${encodedPass}@${hostAndQuery}`
      }
    }
  }

  if (uri.includes('.mongodb.net/?')) {
    uri = uri.replace('.mongodb.net/?', '.mongodb.net/crackvault?')
  } else if (uri.endsWith('.mongodb.net') || uri.endsWith('.mongodb.net/')) {
    uri = uri.replace(/\/?$/, '/crackvault')
  }

  return uri
}

const app = express()
const PORT = process.env.PORT || 5000
const rawMongoUri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI
const MONGODB_URI = formatMongoUri(rawMongoUri)

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true
  })
)
app.use(express.json({ limit: '10mb' }))

// MongoDB Atlas Connection Manager with cooldown to prevent API request blocking
let dbStatus = 'disconnected'
let connectionPromise = null
let lastConnectAttempt = 0
const RECONNECT_COOLDOWN_MS = 25000

// Disable command buffering so disconnected operations fail immediately (<1ms) instead of hanging 10 seconds
mongoose.set('bufferCommands', false)

export async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    dbStatus = 'connected'
    return mongoose.connection
  }

  const now = Date.now()
  if (now - lastConnectAttempt < RECONNECT_COOLDOWN_MS) {
    // Within cooldown: serve immediately from in-memory fallback without 5-second blocking lag
    return null
  }

  if (!connectionPromise) {
    lastConnectAttempt = now
    connectionPromise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000
      })
      .then((m) => {
        dbStatus = 'connected'
        console.log('⚡ [CrackVault Backend] Connected to MongoDB Atlas successfully!')
        return m
      })
      .catch((err) => {
        dbStatus = 'error'
        connectionPromise = null
        console.warn('⚠️ [CrackVault Backend] MongoDB offline/standby (serving from memory cache):', err.message)
        return null
      })
  }

  return connectionPromise
}

// Ensure database connection middleware for all API calls
app.use(async (req, res, next) => {
  if (req.path !== '/api/health' && req.path !== '/health') {
    if (mongoose.connection.readyState !== 1) {
      try {
        await connectToDatabase()
      } catch {
        // Handled by in-memory fallback
      }
    }
  }
  next()
})

// Mongoose connection event listeners
mongoose.connection.on('connected', () => {
  dbStatus = 'connected'
  console.log('📦 [Mongoose] Connected to database cluster.')
})

mongoose.connection.on('error', (err) => {
  dbStatus = 'error'
  console.error('❌ [Mongoose] Connection error:', err.message)
})

mongoose.connection.on('disconnected', () => {
  dbStatus = 'disconnected'
  console.warn('⚠️ [Mongoose] Disconnected from database cluster.')
})

// Kick off initial connection
connectToDatabase().catch(() => {})

// Health Route (handles both /api/health and /health)
const handleHealth = (req, res) => {
  res.json({
    status: 'ok',
    service: 'crackvault-backend',
    timestamp: new Date().toISOString(),
    database: {
      status: mongoose.connection.readyState === 1 ? 'connected' : dbStatus,
      name: mongoose.connection.name || 'crackvault',
      host: mongoose.connection.host || 'unknown'
    }
  })
}
app.get('/api/health', handleHealth)
app.get('/health', handleHealth)

// Reset All Route
const handleResetAll = async (req, res) => {
  try {
    await Promise.all([
      Session.deleteMany({}),
      Player.deleteMany({}),
      Challenge.deleteMany({}),
      Score.deleteMany({})
    ])
    console.log('🧹 [CrackVault Backend] Database reset to clean state.')
    return res.json({ success: true, message: 'All database data successfully reset' })
  } catch (err) {
    console.error('❌ [Reset API] Error resetting database:', err.message)
    return res.status(500).json({ error: err.message })
  }
}
app.post('/api/reset-all', handleResetAll)
app.post('/reset-all', handleResetAll)

// API Routes (Mounted on both /api/* and /* for full Vercel rewrite compatibility)
app.use('/api/sessions', sessionsRouter)
app.use('/sessions', sessionsRouter)

app.use('/api/players', playersRouter)
app.use('/players', playersRouter)

app.use('/api/challenges', challengesRouter)
app.use('/challenges', challengesRouter)

app.use('/api/scores', scoresRouter)
app.use('/scores', scoresRouter)

app.use('/api/settings', settingsRouter)
app.use('/settings', settingsRouter)

// Start Server (standalone Node process)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 [CrackVault Server] Running on http://localhost:${PORT}`)
    console.log(`   Health check: http://localhost:${PORT}/api/health`)
  })
}

export default app
