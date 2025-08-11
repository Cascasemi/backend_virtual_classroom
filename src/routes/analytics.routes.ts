import { Router } from 'express';
import { auth } from '../middleware/auth';
import { getAnalyticsData } from '../controllers/analytics.controller';

const router = Router();

// Analytics routes - require admin access
router.get('/data', auth('admin'), getAnalyticsData);

export default router;
