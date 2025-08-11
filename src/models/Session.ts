import mongoose, { Document, Schema } from 'mongoose';

export interface ISession extends Document {
  title: string;
  course: mongoose.Types.ObjectId;
  teacher: mongoose.Types.ObjectId;
  meetingId: string;
  meetingUrl: string;
  startTime: Date;
  duration: number; // in minutes
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  participants: {
    user: mongoose.Types.ObjectId;
    joinedAt?: Date;
    leftAt?: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const SessionSchema = new Schema<ISession>({
  title: {
    type: String,
    required: true,
    trim: true
  },
  course: {
    type: Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  teacher: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  meetingId: {
    type: String,
    required: true,
    unique: true
  },
  meetingUrl: {
    type: String,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 5,
    max: 480 // 8 hours max
  },
  status: {
    type: String,
    enum: ['scheduled', 'live', 'ended', 'cancelled'],
    default: 'scheduled'
  },
  participants: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: Date,
    leftAt: Date
  }]
}, {
  timestamps: true
});

// Index for better query performance
SessionSchema.index({ teacher: 1, startTime: 1 });
SessionSchema.index({ course: 1, startTime: 1 });
SessionSchema.index({ status: 1, startTime: 1 });

export default mongoose.model<ISession>('Session', SessionSchema);
