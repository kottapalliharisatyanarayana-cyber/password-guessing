import mongoose from 'mongoose'

const challengeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    category: { type: String, default: 'General' },
    password: { type: String, required: true },
    caseSensitive: { type: Boolean, default: false },
    hints: { type: [String], default: [] },
    hintItems: { type: [Object], default: [] },
    hintIntervalSeconds: { type: Number, default: 45 },
    imageUrl: { type: String },
    isImageClue: { type: Boolean, default: false },
    visualClueUnlockSeconds: { type: Number },
    timeLimit: { type: Number, default: 300 },
    difficulty: { type: String, default: 'Medium' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String }
  },
  {
    timestamps: true,
    strict: false,
    toJSON: {
      transform: (_, ret) => {
        delete ret._id
        delete ret.__v
        return ret
      }
    }
  }
)

export const Challenge = mongoose.model('Challenge', challengeSchema)
