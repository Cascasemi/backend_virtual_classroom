import { Request, Response } from 'express';
import { User } from '../models/User';
import bcrypt from 'bcrypt';

export class UsersController {
  static async getAllUsers(req: Request, res: Response) {
    try {
      const users = await User.find({}, '-passwordHash -refreshTokens -verification -reset').lean();
      const mapped = users.map(u => ({ ...u, classYear: (u as any).classYear ?? null }));
      res.json({ users: mapped });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  static async getStudents(req: Request, res: Response) {
    try {
      const { prefix } = req.query as { prefix?: string };
      const filter: any = { role: 'student' };
      if (prefix) {
        filter.classCode = prefix.toUpperCase();
      }
      const students = await User.find(filter, 'name email classCode').sort({ name: 1 });
      res.json({ students });
    } catch (error) {
      console.error('Get students error:', error);
      res.status(500).json({ error: 'Failed to fetch students' });
    }
  }

  static async createUser(req: Request, res: Response) {
    try {
      const { name, email, password, role } = req.body;
      if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
      }
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({
        name,
        email,
        passwordHash,
        role,
        emailVerified: true, // Admin-created users are auto-verified
        isApproved: true // Admin-created users are auto-approved
      });
      
      // Return user without sensitive fields
      const userResponse = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        isApproved: user.isApproved,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      };
      
      res.json({ success: true, user: userResponse });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }

  static async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.sub;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { name, classYear, classCode } = req.body;
      const update: any = {};
      if (name !== undefined) update.name = name;
      if (classYear !== undefined) {
        if (classYear === null || (classYear >=1 && classYear <=6)) update.classYear = classYear; else return res.status(400).json({ error: 'Invalid classYear' });
      }
      if (classCode !== undefined) {
        if (classCode === null || /^[A-Za-z]{2}\d$/.test(classCode)) update.classCode = classCode?.toUpperCase(); else return res.status(400).json({ error: 'Invalid classCode' });
      }
      const user = await User.findByIdAndUpdate(userId, update, { new: true }).select('-passwordHash -refreshTokens -verification -reset');
      res.json({ success: true, user });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
}
