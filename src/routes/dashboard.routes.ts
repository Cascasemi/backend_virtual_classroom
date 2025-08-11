import { Router } from 'express';
import { auth } from '../middleware/auth';
import { getDashboardStats } from '../controllers/dashboard.controller';

const router = Router();

// Dashboard statistics - requires authentication
router.get('/stats', auth(), getDashboardStats);

export default router;
