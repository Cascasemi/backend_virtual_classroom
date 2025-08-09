import { Request, Response } from 'express';
import Resource from '../models/Resource';
import cloudinary from '../config/cloudinary';
import { AuthRequest } from '../middleware/auth';

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
    const { name, type, url, fileSize, mimeType, cloudinaryPublicId } = req.body;
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
    
    // Determine resource type for Cloudinary
    let resourceType: 'image' | 'video' | 'raw' = 'raw';
    if (type === 'image') {
      resourceType = 'image';
    } else if (type === 'video') {
      resourceType = 'video';
    }

    // Extract file extension from original filename
    const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase() || '';
    const baseFilename = req.file.originalname.replace(/\.[^/.]+$/, ""); // Remove extension

    console.log('Uploading to Cloudinary with resource type:', resourceType);

    // Upload to Cloudinary using buffer (memory storage)
    const result = await new Promise((resolve, reject) => {
      const uploadOptions: any = {
        resource_type: resourceType,
        folder: 'virtuclass/resources',
        use_filename: true,
        unique_filename: true,
      };

      // For raw files (documents), preserve the file extension
      if (resourceType === 'raw' && fileExtension) {
        uploadOptions.public_id = `${baseFilename}_${Date.now()}`;
        uploadOptions.format = fileExtension;
      }

      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('Cloudinary upload successful:', result?.secure_url);
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
