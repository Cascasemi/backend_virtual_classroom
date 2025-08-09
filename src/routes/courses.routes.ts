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
router.put('/:courseId/enrollments', CoursesController.updateEnrollments);
router.post('/:courseId/self-enroll', CoursesController.selfEnroll);

// Content management for courses
router.get('/:courseId/content', CoursesController.getContent);
router.post('/:courseId/modules', CoursesController.createModule);
router.post('/:courseId/modules/:moduleId/lessons/:lessonId?', CoursesController.upsertLesson);

// Get available teachers for course assignment
router.get('/teachers/available', CoursesController.getAvailableTeachers);

export default router;
