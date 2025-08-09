import { Schema, model, Types, Document } from 'mongoose';

export interface ICourse extends Document {
  title: string;
  description: string;
  instructor?: Types.ObjectId;
  students: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>({
  title: { type: String, required: true },
  description: { type: String, required: true },
  instructor: { type: Schema.Types.ObjectId, ref: 'User' },
  students: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

export const Course = model<ICourse>('Course', CourseSchema);
