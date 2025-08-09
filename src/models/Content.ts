import { Schema, model, Document, Types } from 'mongoose';

export interface IModule extends Document {
  course: Types.ObjectId;
  title: string;
  description?: string;
  order: number;
  lessons: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ILesson extends Document {
  module: Types.ObjectId;
  course: Types.ObjectId;
  title: string;
  content?: string; // rich text / markdown
  images: string[]; // store URLs or filenames (placeholder for now)
  videoUrl?: string; // YouTube or Vimeo
  quiz?: {
    questions: Array<{
      question: string;
      options: string[];
      answerIndex: number; // ungraded, just for self-check
    }>;
  };
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const LessonSchema = new Schema<ILesson>({
  module: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true },
  content: { type: String },
  images: { type: [String], default: [] },
  videoUrl: { type: String, validate: {
    validator: (v: string) => !v || /^(https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\/).+/.test(v),
    message: 'Only YouTube or Vimeo URLs allowed'
  } },
  quiz: {
    questions: [{
      question: { type: String, required: true },
      options: { type: [String], required: true },
      answerIndex: { type: Number, required: true }
    }]
  },
  order: { type: Number, default: 0 }
}, { timestamps: true });

const ModuleSchema = new Schema<IModule>({
  course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true },
  description: { type: String },
  order: { type: Number, default: 0 },
  lessons: [{ type: Schema.Types.ObjectId, ref: 'Lesson' }]
}, { timestamps: true });

export const Module = model<IModule>('Module', ModuleSchema);
export const Lesson = model<ILesson>('Lesson', LessonSchema);
