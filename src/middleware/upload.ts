import multer from 'multer';

// Use memory storage for direct upload to Cloudinary
const storage = multer.memoryStorage();

// File filter to validate file types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    video: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm', 'video/x-msvideo'],
    document: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ]
  };

  const { type } = req.body;
  let allowedMimeTypes: string[] = [];

  if (type === 'image') {
    allowedMimeTypes = allowedTypes.image;
  } else if (type === 'video') {
    allowedMimeTypes = allowedTypes.video;
  } else if (type === 'document') {
    allowedMimeTypes = allowedTypes.document;
  } else {
    // If no type specified, allow all supported types
    allowedMimeTypes = [...allowedTypes.image, ...allowedTypes.video, ...allowedTypes.document];
  }

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. File type: ${file.mimetype}. Allowed types for ${type}: ${allowedMimeTypes.join(', ')}`));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

export default upload;
