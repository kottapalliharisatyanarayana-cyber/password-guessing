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

// Load environment variables
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const app = express()
const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI

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

if (!MONGODB_URI) {
  console.warn('\n⚠️ [CrackVault Backend] MONGODB_URI is not set in .env!')
  console.warn('👉 Please set MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/crackvault in your .env file.\n')
} else {
  mongoose
    .connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
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

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 [CrackVault Server] Running on http://localhost:${PORT}`)
  console.log(`   Health check: http://localhost:${PORT}/api/health`)
})

export default app
