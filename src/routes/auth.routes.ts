import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { auth } from '../middleware/auth';

export const authRouter = Router();

// Public routes
authRouter.post('/register', AuthController.register);
authRouter.get('/verify-email', AuthController.verifyEmail);
authRouter.post('/login', AuthController.login);
authRouter.post('/refresh', AuthController.refresh);
authRouter.post('/forgot-password', AuthController.forgotPassword);
authRouter.post('/reset-password', AuthController.resetPassword);
authRouter.post('/logout', AuthController.logout);

// Admin-only routes for teacher approval
authRouter.get('/pending-teachers', auth('admin'), AuthController.getPendingTeachers);
authRouter.put('/approve-teacher/:teacherId', auth('admin'), AuthController.approveTeacher);
authRouter.delete('/reject-teacher/:teacherId', auth('admin'), AuthController.rejectTeacher);
