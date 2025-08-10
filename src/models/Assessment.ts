import mongoose, { Document, Schema } from 'mongoose';

export type AssessmentType = 'quiz' | 'assignment' | 'exam';
export type AssessmentStatus = 'draft' | 'published' | 'closed';

export interface IQuestion extends Document {
  question: string;
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  options?: string[]; // For multiple choice
  correctAnswer?: string | number; // For auto-graded questions
  points: number;
  explanation?: string;
}

export interface IAssessment extends Document {
  title: string;
  description?: string;
  type: AssessmentType;
  course: mongoose.Types.ObjectId;
  teacher: mongoose.Types.ObjectId;
  
  // Scheduling
  startDate: Date;
  endDate: Date;
  duration: number; // in minutes
  
  // Settings
  attempts: number; // Number of allowed attempts
  showResults: boolean; // Show results immediately after submission
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  passingScore?: number; // Percentage required to pass
  
  // Questions
  questions: IQuestion[];
  totalPoints: number;
  
  // Status
  status: AssessmentStatus;
  isActive: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  question: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['multiple_choice', 'true_false', 'short_answer', 'essay'],
    required: true
  },
  options: [{
    type: String,
    trim: true
  }],
  correctAnswer: {
    type: Schema.Types.Mixed // Can be string or number
  },
  points: {
    type: Number,
    required: true,
    min: 0
  },
  explanation: {
    type: String,
    trim: true
  }
});

const AssessmentSchema = new Schema<IAssessment>({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['quiz', 'assignment', 'exam'],
    required: true
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
  
  // Scheduling
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 1 // At least 1 minute
  },
  
  // Settings
  attempts: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  showResults: {
    type: Boolean,
    default: true
  },
  shuffleQuestions: {
    type: Boolean,
    default: false
  },
  shuffleOptions: {
    type: Boolean,
    default: false
  },
  passingScore: {
    type: Number,
    min: 0,
    max: 100
  },
  
  // Questions
  questions: [QuestionSchema],
  totalPoints: {
    type: Number,
    default: 0
  },
  
  // Status
  status: {
    type: String,
    enum: ['draft', 'published', 'closed'],
    default: 'draft'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true 
});

// Calculate total points before saving
AssessmentSchema.pre('save', function() {
  this.totalPoints = this.questions.reduce((total, question) => total + question.points, 0);
});

// Index for efficient queries
AssessmentSchema.index({ course: 1, teacher: 1 });
AssessmentSchema.index({ startDate: 1, endDate: 1 });
AssessmentSchema.index({ status: 1, isActive: 1 });

export const Assessment = mongoose.model<IAssessment>('Assessment', AssessmentSchema);
