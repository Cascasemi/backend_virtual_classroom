import { Router } from 'express';
import { UsersController } from '../controllers/users.controller';
import { auth } from '../middleware/auth';

export const usersRouter = Router();

// Admin-only routes
usersRouter.get('/', auth('admin'), UsersController.getAllUsers);
usersRouter.post('/', auth('admin'), UsersController.createUser);

// Shared routes
usersRouter.get('/students', auth('admin', 'teacher'), UsersController.getStudents);
usersRouter.put('/me', auth(), UsersController.updateProfile);
