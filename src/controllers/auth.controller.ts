import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../models/User';
import { signAccess, signRefresh, verifyRefresh } from '../utils/jwt';
import { sendVerificationEmail, sendResetEmail } from '../services/mailer';

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { email, password, name, role } = req.body;
      
      // Validate required fields
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'Email, password, and name are required' });
      }
      
      // Check if email already exists
      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ error: 'Email already in use' });
      
      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);
      
      // Generate email verification token
      const token = crypto.randomBytes(32).toString('hex');
      
      // Create user
      const user = await User.create({
        email,
        passwordHash,
        name,
        role: role || 'student',
        verification: { token, expiresAt: new Date(Date.now() + 86400000) } // 24 hours
      });
      
      // Send verification email
      // await sendVerificationEmail(email, token); // Disabled for local development
      
      // Different response messages based on role
      if (role === 'teacher') {
        res.json({ 
          success: true, 
          message: 'Registration successful! Please verify your email and wait for admin approval to access teacher features.',
          requiresApproval: true 
        });
      } else {
        res.json({ 
          success: true, 
          message: 'Registration successful! Please check your email to verify your account.',
          requiresApproval: false 
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async verifyEmail(req: Request, res: Response) {
    const { email, token } = req.query as { email: string; token: string };
    const user = await User.findOne({ email, 'verification.token': token });
    if (!user) return res.status(400).json({ error: 'Invalid token' });
    if (user.verification!.expiresAt < new Date()) return res.status(400).json({ error: 'Token expired' });
    user.emailVerified = true;
    user.verification = undefined;
    await user.save();
    res.json({ success: true });
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      
      // Validate required fields
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      
      // Find user
      const user = await User.findOne({ email });
      if (!user) return res.status(400).json({ error: 'Invalid credentials' });
      
      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) return res.status(400).json({ error: 'Invalid credentials' });
      
      // Check if email is verified
      if (!user.emailVerified) {
        return res.status(403).json({ 
          error: 'Email not verified', 
          code: 'EMAIL_NOT_VERIFIED' 
        });
      }
      
      // Check if teacher is approved by admin
      if (user.role === 'teacher' && !user.isApproved) {
        return res.status(403).json({ 
          error: 'Your teacher account is pending admin approval', 
          code: 'PENDING_APPROVAL' 
        });
      }
      
      // Generate tokens
      const access = signAccess({ 
        sub: user._id, 
        role: user.role, 
        email: user.email, 
        name: user.name 
      });
      const refresh = signRefresh({ sub: user._id });
      
      // Store refresh token
      user.refreshTokens.push({ token: refresh, createdAt: new Date() });
      await user.save();
      
      // Return user data and tokens
      res.json({ 
        success: true,
        access, 
        refresh, 
        user: { 
          id: user._id, 
          email: user.email, 
          role: user.role, 
          name: user.name,
          isApproved: user.isApproved,
          emailVerified: user.emailVerified,
          classYear: (user as any).classYear ?? null,
          classCode: (user as any).classCode ?? null
        } 
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async refresh(req: Request, res: Response) {
    const { refresh } = req.body;
    if (!refresh) return res.status(400).json({ error: 'Missing refresh token' });
    try {
      const decoded: any = verifyRefresh(refresh);
      const user = await User.findById(decoded.sub);
      if (!user || !user.refreshTokens.some(r => r.token === refresh)) return res.status(401).json({ error: 'Invalid refresh token' });
      user.refreshTokens = user.refreshTokens.filter(r => r.token !== refresh);
      const newRefresh = signRefresh({ sub: user._id });
      user.refreshTokens.push({ token: newRefresh, createdAt: new Date() });
      await user.save();
      const access = signAccess({ sub: user._id, role: user.role });
      res.json({ access, refresh: newRefresh });
    } catch {
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }

  static async forgotPassword(req: Request, res: Response) {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.reset = { token, expiresAt: new Date(Date.now() + 3600000) };
      await user.save();
      await sendResetEmail(email, token);
    }
    res.json({ success: true });
  }

  static async resetPassword(req: Request, res: Response) {
    const { email, token, password } = req.body;
    const user = await User.findOne({ email, 'reset.token': token });
    if (!user || user.reset!.expiresAt < new Date()) return res.status(400).json({ error: 'Invalid token' });
    user.passwordHash = await bcrypt.hash(password, 12);
    user.reset = undefined;
    await user.save();
    res.json({ success: true });
  }

  static async logout(req: Request, res: Response) {
    const { refresh } = req.body;
    if (!refresh) return res.status(400).json({ error: 'Missing refresh token' });
    const user = await User.findOne({ 'refreshTokens.token': refresh });
    if (user) {
      user.refreshTokens = user.refreshTokens.filter(r => r.token !== refresh);
      await user.save();
    }
    res.json({ success: true });
  }

  // Admin methods for teacher approval
  static async getPendingTeachers(req: Request, res: Response) {
    try {
      const pendingTeachers = await User.find({
        role: 'teacher',
        emailVerified: true,
        isApproved: false
      }).select('email name createdAt').sort({ createdAt: -1 });
      
      res.json({ teachers: pendingTeachers });
    } catch (error) {
      console.error('Get pending teachers error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async approveTeacher(req: Request, res: Response) {
    try {
      const { teacherId } = req.params;
      
      const teacher = await User.findById(teacherId);
      if (!teacher) {
        return res.status(404).json({ error: 'Teacher not found' });
      }
      
      if (teacher.role !== 'teacher') {
        return res.status(400).json({ error: 'User is not a teacher' });
      }
      
      teacher.isApproved = true;
      await teacher.save();
      
      res.json({ success: true, message: 'Teacher approved successfully' });
    } catch (error) {
      console.error('Approve teacher error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async rejectTeacher(req: Request, res: Response) {
    try {
      const { teacherId } = req.params;
      
      const teacher = await User.findById(teacherId);
      if (!teacher) {
        return res.status(404).json({ error: 'Teacher not found' });
      }
      
      if (teacher.role !== 'teacher') {
        return res.status(400).json({ error: 'User is not a teacher' });
      }
      
      // You can either delete the user or keep them with isApproved: false
      // For now, we'll delete them
      await User.findByIdAndDelete(teacherId);
      
      res.json({ success: true, message: 'Teacher registration rejected and account removed' });
    } catch (error) {
      console.error('Reject teacher error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
