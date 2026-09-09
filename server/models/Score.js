import mongoose from 'mongoose'

const scoreSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    sessionId: { type: String, required: true, index: true },
    playerName: { type: String, required: true },
    avatar: { type: String, default: '⚡' },
    challengeTitle: { type: String, default: 'Vault Mission' },
    solveTime: { type: Number, default: 0 },
    attempts: { type: Number, default: 1 },
    hintsUsed: { type: Number, default: 0 },
    score: { type: Number, default: 0, index: -1 },
    createdAt: { type: String }
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

export const Score = mongoose.model('Score', scoreSchema)
