import { Router } from 'express';
import { auth } from '../middleware/auth';
import upload from '../middleware/upload';
import {
  getAllResources,
  createResource,
  uploadFile,
  deleteResource
} from '../controllers/resources.controller';

const router = Router();

// Test endpoint to verify routes are working (no auth required)
router.get('/test', (req, res) => {
  console.log('Resources test endpoint hit');
  res.json({ message: 'Resources routes working', timestamp: new Date().toISOString() });
});

// Apply auth middleware to protected routes - only teachers can manage resources
router.use(auth('teacher'));

// Get all resources
router.get('/', getAllResources);

// Upload file to Cloudinary with error handling
router.post('/upload', (req, res, next) => {
  console.log('Upload endpoint hit, user:', req.user?.email, 'role:', req.user?.role);
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload error'
      });
    }
    console.log('Multer processing complete, proceeding to upload handler...');
    next();
  });
}, uploadFile);

// Create resource (with URL)
router.post('/', createResource);

// Delete resource
router.delete('/:id', deleteResource);

export default router;
