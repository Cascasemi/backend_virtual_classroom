import mongoose, { Document, Schema } from 'mongoose';

export interface ISubmissionAnswer {
  questionId: string;
  answer: string | number | string[]; // Various answer types
  timeSpent?: number; // Time spent on this question in seconds
}

export interface ISubmission extends Document {
  assessment: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  answers: ISubmissionAnswer[];
  
  // Timing
  startedAt: Date;
  submittedAt?: Date;
  timeElapsed: number; // Total time in seconds
  
  // Scoring
  score?: number; // Points earned
  percentage?: number; // Percentage score
  graded: boolean;
  gradedBy?: mongoose.Types.ObjectId;
  gradedAt?: Date;
  
  // Attempt tracking
  attemptNumber: number;
  
  // Status
  status: 'in_progress' | 'submitted' | 'graded' | 'late';
  
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionAnswerSchema = new Schema({
  questionId: {
    type: String,
    required: true
  },
  answer: {
    type: Schema.Types.Mixed,
    required: true
  },
  timeSpent: {
    type: Number,
    default: 0
  }
});

const SubmissionSchema = new Schema<ISubmission>({
  assessment: {
    type: Schema.Types.ObjectId,
    ref: 'Assessment',
    required: true
  },
  student: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answers: [SubmissionAnswerSchema],
  
  // Timing
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  submittedAt: {
    type: Date
  },
  timeElapsed: {
    type: Number,
    default: 0
  },
  
  // Scoring
  score: {
    type: Number,
    min: 0
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100
  },
  graded: {
    type: Boolean,
    default: false
  },
  gradedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  gradedAt: {
    type: Date
  },
  
  // Attempt tracking
  attemptNumber: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Status
  status: {
    type: String,
    enum: ['in_progress', 'submitted', 'graded', 'late'],
    default: 'in_progress'
  }
}, { 
  timestamps: true 
});

// Compound index to ensure unique attempts per student per assessment
SubmissionSchema.index({ assessment: 1, student: 1, attemptNumber: 1 }, { unique: true });
SubmissionSchema.index({ assessment: 1, status: 1 });
SubmissionSchema.index({ student: 1, submittedAt: 1 });

export const Submission = mongoose.model<ISubmission>('Submission', SubmissionSchema);
