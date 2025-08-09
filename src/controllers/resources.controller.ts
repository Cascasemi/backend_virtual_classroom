import { Request, Response } from 'express';
import Resource from '../models/Resource';
import { Course } from '../models/Course';
import cloudinary from '../config/cloudinary';
import { AuthRequest } from '../middleware/auth';

export const getAvailableClasses = async (req: AuthRequest, res: Response) => {
  try {
    // Get all unique course codes and extract first 3 characters as classes
    const courses = await Course.find({ isActive: true }).select('code');
    const classes = [...new Set(courses.map(course => course.code.substring(0, 3)))].sort();
    
    res.json({
      success: true,
      classes
    });
  } catch (error: any) {
    console.error('Get classes error:', error);
    res.status(500).json({ success: false, message: 'Failed to get classes' });
  }
};

export const getStudentResources = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    
    // Find courses the student is enrolled in
    const enrolledCourses = await Course.find({ 
      students: userId, 
      isActive: true 
    }).select('code');
    
    // Extract class codes (first 3 characters of course codes)
    const studentClassCodes = enrolledCourses.map(course => course.code.substring(0, 3));
    const uniqueClassCodes = [...new Set(studentClassCodes)];
    
    // Find resources for student's classes or general resources (no class assigned)
    const resources = await Resource.find({ 
      isActive: true,
      $or: [
        { classCode: { $in: uniqueClassCodes } },
        { classCode: { $exists: false } },
        { classCode: null }
      ]
    })
    .populate('uploadedBy', 'name email')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      resources,
      studentClasses: uniqueClassCodes
    });
  } catch (error: any) {
    console.error('Get student resources error:', error);
    res.status(500).json({ success: false, message: 'Failed to get resources' });
  }
};

export const getAllResources = async (req: AuthRequest, res: Response) => {
  try {
    const resources = await Resource.find({ isActive: true })
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, resources });
  } catch (error: any) {
    console.error('Get resources error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch resources' });
  }
};

export const createResource = async (req: AuthRequest, res: Response) => {
  try {
    const { name, type, url, fileSize, mimeType, cloudinaryPublicId, classCode } = req.body;
    const uploadedBy = req.user!.sub; // Use 'sub' from JWT payload

    // Validate required fields
    if (!name || !type || !url) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, type, and URL are required' 
      });
    }

    // Validate type
    const validTypes = ['document', 'video', 'link', 'image'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid resource type' 
      });
    }

    const resource = new Resource({
      name,
      type,
      url,
      fileSize: fileSize || 0,
      mimeType,
      cloudinaryPublicId,
      classCode: classCode || null,
      uploadedBy
    });

    await resource.save();
    await resource.populate('uploadedBy', 'name email');

    res.status(201).json({ 
      success: true, 
      resource,
      message: 'Resource created successfully' 
    });
  } catch (error: any) {
    console.error('Create resource error:', error);
    res.status(500).json({ success: false, message: 'Failed to create resource' });
  }
};

export const uploadFile = async (req: AuthRequest, res: Response) => {
  try {
    console.log('Upload request received:', {
      hasFile: !!req.file,
      body: req.body,
      user: req.user?.email || 'No user (testing mode)'
    });

    if (!req.file) {
      console.log('No file in request');
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    const { type } = req.body;
    console.log('Processing file upload:', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      type: type
    });
    
    // Let Cloudinary auto-detect the resource type based on file content
    console.log('Uploading to Cloudinary with auto-detection');

    // Upload to Cloudinary using buffer (memory storage) - let Cloudinary handle everything
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'virtuclass/resources',
          use_filename: true,
          unique_filename: true,
          resource_type: 'auto', // Let Cloudinary auto-detect
          // Don't specify public_id, let Cloudinary handle naming
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('Cloudinary upload successful:', result?.secure_url);
            console.log('Cloudinary detected resource type:', result?.resource_type);
            console.log('Cloudinary format:', result?.format);
            resolve(result);
          }
        }
      ).end(req.file!.buffer);
    }) as any;

    const response = {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      fileSize: result.bytes,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname
    };

    console.log('Sending response:', response);
    res.json(response);
  } catch (error: any) {
    console.error('File upload error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload file: ' + (error.message || 'Unknown error')
    });
  }
};

export const downloadResource = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log('Download request for resource ID:', id);
    
    const resource = await Resource.findById(id);
    if (!resource || !resource.isActive) {
      console.log('Resource not found or inactive:', id);
      return res.status(404).json({ 
        success: false, 
        message: 'Resource not found' 
      });
    }

    console.log('Resource found:', {
      name: resource.name,
      url: resource.url,
      mimeType: resource.mimeType
    });

    // Return the direct Cloudinary URL - let the browser handle the download
    res.json({
      success: true,
      downloadUrl: resource.url,
      filename: resource.name,
      mimeType: resource.mimeType
    });
  } catch (error: any) {
    console.error('Download resource error:', error);
    res.status(500).json({ success: false, message: 'Failed to get download URL' });
  }
};

export const deleteResource = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.sub; // Use 'sub' from JWT payload
    const userRole = req.user!.role;

    const resource = await Resource.findById(id);
    if (!resource) {
      return res.status(404).json({ 
        success: false, 
        message: 'Resource not found' 
      });
    }

    // Check if user can delete (admin or owner)
    if (userRole !== 'admin' && resource.uploadedBy.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this resource' 
      });
    }

    // Delete from Cloudinary if it has a public ID
    if (resource.cloudinaryPublicId) {
      try {
        let resourceType: 'image' | 'video' | 'raw' = 'raw';
        if (resource.type === 'image') {
          resourceType = 'image';
        } else if (resource.type === 'video') {
          resourceType = 'video';
        }
        
        await cloudinary.uploader.destroy(resource.cloudinaryPublicId, {
          resource_type: resourceType
        });
      } catch (cloudError) {
        console.error('Cloudinary deletion error:', cloudError);
      }
    }

    // Soft delete
    resource.isActive = false;
    await resource.save();

    res.json({ 
      success: true, 
      message: 'Resource deleted successfully' 
    });
  } catch (error: any) {
    console.error('Delete resource error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete resource' });
  }
};
