import { Router } from 'express';
import { auth } from '../middleware/auth';
import {
  createAssessment,
  getTeacherAssessments,
  getStudentAssessments,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  publishAssessment,
  getAssessmentStats,
  startAssessment,
  unpublishAssessment
} from '../controllers/assessments.controller';
import {
  submitAssessment,
  saveProgress,
  getSubmission,
  gradeSubmission,
  getStudentSubmissions,
  getAssessmentSubmissions,
  getSubmissionResults
} from '../controllers/submissions.controller';

const router = Router();

// Assessment routes
router.post('/', auth('teacher'), createAssessment);
router.get('/teacher', auth('teacher'), getTeacherAssessments);
router.get('/student', auth('student'), getStudentAssessments);
router.get('/:id', auth(), getAssessmentById);
router.put('/:id', auth('teacher'), updateAssessment);
router.delete('/:id', auth('teacher'), deleteAssessment);
router.patch('/:id/publish', auth('teacher'), publishAssessment);
router.patch('/:id/unpublish', auth('teacher'), unpublishAssessment);
router.get('/:id/stats', auth('teacher'), getAssessmentStats);

// Student assessment interaction
router.post('/:id/start', auth('student'), startAssessment);
router.get('/:assessmentId/submissions/student', auth('student'), getStudentSubmissions);

// Submission routes
router.post('/submissions/:submissionId/submit', auth('student'), submitAssessment);
router.patch('/submissions/:submissionId/progress', auth('student'), saveProgress);
router.get('/submissions/:submissionId', auth(), getSubmission);
router.get('/submissions/:submissionId/results', auth(), getSubmissionResults);
router.post('/submissions/:submissionId/grade', auth('teacher'), gradeSubmission);
router.get('/:assessmentId/submissions', auth('teacher'), getAssessmentSubmissions);

export default router;
