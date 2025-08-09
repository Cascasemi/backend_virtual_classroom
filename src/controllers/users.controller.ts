import { Request, Response } from 'express';
import { User } from '../models/User';
import bcrypt from 'bcrypt';

export class UsersController {
  static async getAllUsers(req: Request, res: Response) {
    try {
      const users = await User.find({}, '-passwordHash -refreshTokens -verification -reset').lean();
      res.json({ users });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
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
}
