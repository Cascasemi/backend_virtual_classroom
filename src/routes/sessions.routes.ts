import { Router } from 'express';
import { auth } from '../middleware/auth';
import {
  createSession,
  listSessions,
  getSession,
  joinSession,
  updateSessionStatus,
  deleteSession
} from '../controllers/sessions.controller';

const router = Router();

// All routes require authentication
router.use(auth('teacher', 'admin', 'student'));

// Create session (teachers and admins only)
router.post('/', auth('teacher', 'admin'), createSession);

// List sessions (all authenticated users)
router.get('/', listSessions);

// Get specific session
router.get('/:id', getSession);

// Join session (all authenticated users)
router.post('/:id/join', joinSession);

// Update session status (teachers and admins only)
router.patch('/:id/status', auth('teacher', 'admin'), updateSessionStatus);

// Delete session (teachers and admins only)
router.delete('/:id', auth('teacher', 'admin'), deleteSession);

export default router;
