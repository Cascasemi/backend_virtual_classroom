import { Schema, model, Document } from 'mongoose';

export interface ICourse extends Document {
  name: string;
  code: string;
  yearGroup: number;
  teacher?: Schema.Types.ObjectId;
  students: Schema.Types.ObjectId[];
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true, uppercase: true },
  yearGroup: { type: Number, required: true, min: 1, max: 6 },
  teacher: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  students: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Compound index to ensure unique course code per year group
CourseSchema.index({ code: 1, yearGroup: 1 }, { unique: true });

export const Course = model<ICourse>('Course', CourseSchema);
