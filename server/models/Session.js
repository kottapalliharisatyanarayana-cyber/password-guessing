import mongoose from 'mongoose'

const sessionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    joinCode: { type: String, required: true, index: true },
    challengeId: { type: String },
    challenge: { type: Object },
    status: {
      type: String,
      enum: ['lobby', 'playing', 'paused', 'ended'],
      default: 'lobby',
      index: true
    },
    startedAt: { type: Number },
    totalSeconds: { type: Number, default: 300 },
    remainingSeconds: { type: Number, default: 300 },
    winnerName: { type: String },
    winnerScore: { type: Number },
    forceUnlockedHints: { type: [Number], default: [] },
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

export const Session = mongoose.model('Session', sessionSchema)
