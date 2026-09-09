import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

import sessionsRouter from './routes/sessions.js'
import playersRouter from './routes/players.js'
import challengesRouter from './routes/challenges.js'
import scoresRouter from './routes/scores.js'

import dns from 'dns'

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Configure reliable DNS servers for MongoDB SRV resolution on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1'])
} catch {
  // Ignore if permissions disallow setting custom DNS
}

// Automatically sanitize MongoDB URI (removes < > brackets and encodes special chars in password)
function formatMongoUri(rawUri) {
  if (!rawUri) return rawUri
  let uri = rawUri.trim()
  // Remove angle brackets around placeholders like <username> or <password>
  uri = uri.replace(/<([^>]+)>/g, '$1')

  // Check for credentials part before @cluster
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

  // If no database name was specified before query params, append /crackvault
  if (uri.includes('.mongodb.net/?')) {
    uri = uri.replace('.mongodb.net/?', '.mongodb.net/crackvault?')
  } else if (uri.endsWith('.mongodb.net') || uri.endsWith('.mongodb.net/')) {
    uri = uri.replace(/\/?$/, '/crackvault')
  }

  return uri
}

const app = express()
const PORT = process.env.PORT || 5000
const rawMongoUri = process.env.MONGODB_URI
const MONGODB_URI = formatMongoUri(rawMongoUri)

// Middleware
app.use(
  cors({
    origin: true, // Allow all origins (Vite dev, LAN phones/laptops, Vercel deployments)
    credentials: true
  })
)
app.use(express.json({ limit: '10mb' }))

// MongoDB Atlas Connection
let dbStatus = 'disconnected'

// Disable Mongoose command buffering so queries fail fast and trigger instant memory fallback
mongoose.set('bufferCommands', false)

if (!MONGODB_URI) {
  console.warn('\n⚠️ [CrackVault Backend] MONGODB_URI is not set in .env!')
  console.warn('👉 Please set MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/crackvault in your .env file.\n')
} else {
  mongoose
    .connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 3000
    })
    .then(() => {
      dbStatus = 'connected'
      console.log('⚡ [CrackVault Backend] Connected to MongoDB Atlas successfully!')
    })
    .catch((err) => {
      dbStatus = 'error'
      console.error('❌ [CrackVault Backend] MongoDB Atlas connection error:', err.message)
    })
}

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

// Health Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'crackvault-backend',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      name: mongoose.connection.name || 'crackvault',
      host: mongoose.connection.host || 'unknown'
    }
  })
})

// API Routes
app.use('/api/sessions', sessionsRouter)
app.use('/api/players', playersRouter)
app.use('/api/challenges', challengesRouter)
app.use('/api/scores', scoresRouter)

// Start Server (only when running as standalone Node process, not in Vercel serverless environment)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 [CrackVault Server] Running on http://localhost:${PORT}`)
    console.log(`   Health check: http://localhost:${PORT}/api/health`)
  })
}

export default app
