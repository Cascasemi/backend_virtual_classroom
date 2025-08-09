import { Schema, model, Document } from 'mongoose';

export type UserRole = 'student' | 'teacher' | 'admin';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  name?: string;
  emailVerified: boolean;
  isApproved: boolean; // Admin approval for teachers
  verification?: { token: string; expiresAt: Date };
  reset?: { token: string; expiresAt: Date };
  refreshTokens: { token: string; createdAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

const TokenSchema = new Schema({
  token: String,
  expiresAt: Date
}, { _id: false });

const RefreshSchema = new Schema({
  token: String,
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const UserSchema = new Schema<IUser>({
  email: { type: String, unique: true, required: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['student','teacher','admin'], default: 'student', index: true },
  name: { type: String },
  emailVerified: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: function() { 
    // Auto-approve students and admins, but teachers need approval
    return this.role !== 'teacher'; 
  }},
  verification: TokenSchema,
  reset: TokenSchema,
  refreshTokens: [RefreshSchema]
}, { timestamps: true });

export const User = model<IUser>('User', UserSchema);
