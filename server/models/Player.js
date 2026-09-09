import mongoose from 'mongoose'

const playerSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    sessionId: { type: String, required: true, index: true },
    joinCode: { type: String, index: true },
    name: { type: String, required: true },
    avatar: { type: String, default: '⚡' },
    status: {
      type: String,
      enum: ['waiting', 'playing', 'solved', 'failed'],
      default: 'waiting'
    },
    attempts: { type: Number, default: 0 },
    hintsUsed: { type: Number, default: 0 },
    revealedHints: { type: [Number], default: [] },
    solveTime: { type: Number },
    score: { type: Number, default: 0 },
    joinedAt: { type: String }
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        delete ret._id
        delete ret.__v
        return ret
      }
    }
  }
)

export const Player = mongoose.model('Player', playerSchema)
