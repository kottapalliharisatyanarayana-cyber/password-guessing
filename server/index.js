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

// Fallback URIs: Direct replica set (bypasses Windows/ISP SRV DNS issues) & SRV URI
const DIRECT_MONGODB_URI =
  'mongodb://kottapalliharisatyanarayana_db_user:T4h3OeE5WqHM4Mmw@ac-xif0qt5-shard-00-00.18sjvym.mongodb.net:27017,ac-xif0qt5-shard-00-01.18sjvym.mongodb.net:27017,ac-xif0qt5-shard-00-02.18sjvym.mongodb.net:27017/crackvault?ssl=true&replicaSet=atlas-13c5h8-shard-0&authSource=admin&retryWrites=true&w=majority'
const DEFAULT_MONGODB_URI =
  process.env.MONGODB_URI || DIRECT_MONGODB_URI

// Automatically sanitize MongoDB URI (removes < > brackets and encodes special chars in password)
function formatMongoUri(rawUri) {
  if (!rawUri) return DIRECT_MONGODB_URI
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
const rawMongoUri = process.env.MONGODB_URI || DIRECT_MONGODB_URI
const MONGODB_URI = formatMongoUri(rawMongoUri)

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true
  })
)
app.use(express.json({ limit: '10mb' }))

// MongoDB Atlas Connection Manager
let dbStatus = 'disconnected'
let connectionPromise = null
let lastConnectAttempt = 0
const RECONNECT_COOLDOWN_MS = 3000

export async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    dbStatus = 'connected'
    return mongoose.connection
  }

  const now = Date.now()
  if (now - lastConnectAttempt < RECONNECT_COOLDOWN_MS && dbStatus === 'error') {
    return null
  }

  if (!connectionPromise) {
    lastConnectAttempt = now
    const tryConnect = async (targetUri) => {
      return mongoose.connect(targetUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      })
    }

    connectionPromise = tryConnect(MONGODB_URI)
      .then((m) => {
        dbStatus = 'connected'
        console.log('⚡ [CrackVault Backend] Connected to MongoDB Atlas successfully!')
        return m
      })
      .catch(async (err) => {
        // If SRV lookup failed, immediately attempt direct replica-set fallback
        if (MONGODB_URI.startsWith('mongodb+srv://') && DIRECT_MONGODB_URI !== MONGODB_URI) {
          try {
            console.log('🔄 [CrackVault Backend] Retrying connection using direct replica-set URI...')
            const m = await tryConnect(DIRECT_MONGODB_URI)
            dbStatus = 'connected'
            console.log('⚡ [CrackVault Backend] Connected via direct replica-set successfully!')
            return m
          } catch (directErr) {
            console.warn('⚠️ [CrackVault Backend] Direct replica-set attempt failed:', directErr.message)
          }
        }
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
    if (mongoose.connection.readyState === 0) {
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
