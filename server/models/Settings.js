import mongoose from 'mongoose'

const settingsSchema = new mongoose.Schema(
  {
    id: { type: String, default: 'global_settings', unique: true },
    adminUsername: { type: String, default: 'admin' },
    adminPassword: { type: String, default: 'admin123' },
    defaultTimeLimit: { type: Number, default: 300 },
    soundEnabled: { type: Boolean, default: true }
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

export const Settings = mongoose.model('Settings', settingsSchema)
