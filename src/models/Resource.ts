import mongoose, { Document, Schema } from 'mongoose';

export interface IResource extends Document {
  name: string;
  type: 'document' | 'video' | 'link' | 'image';
  url: string;
  fileSize?: number;
  mimeType?: string;
  cloudinaryPublicId?: string;
  uploadedBy: mongoose.Types.ObjectId;
  classCode?: string; // First three characters of course code
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ResourceSchema = new Schema<IResource>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['document', 'video', 'link', 'image']
  },
  url: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    default: 0
  },
  mimeType: {
    type: String
  },
  cloudinaryPublicId: {
    type: String
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  classCode: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: 3
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for better query performance
ResourceSchema.index({ type: 1, isActive: 1 });
ResourceSchema.index({ uploadedBy: 1 });

export default mongoose.model<IResource>('Resource', ResourceSchema);