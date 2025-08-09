import { Router } from 'express';
import { CoursesController } from '../controllers/courses.controller';
import { auth } from '../middleware/auth';

const router = Router();

// All course routes require authentication
router.use(auth());

// Admin only routes for course management
router.get('/', CoursesController.getAllCourses);
router.post('/', CoursesController.createCourse);
router.put('/:courseId', CoursesController.updateCourse);
router.delete('/:courseId', CoursesController.deleteCourse);

// Get available teachers for course assignment
router.get('/teachers/available', CoursesController.getAvailableTeachers);

export default router;
