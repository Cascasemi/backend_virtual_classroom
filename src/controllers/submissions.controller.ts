import { Response, NextFunction } from 'express';
import { Assessment } from '../models/Assessment';
import { Submission } from '../models/Submission';
import { AuthRequest } from '../middleware/auth';

// Submit assessment answers
export const submitAssessment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { submissionId } = req.params;
    const { answers } = req.body;

    const submission = await Submission.findById(submissionId)
      .populate('assessment');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Check if student owns this submission
    if (submission.student.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if already submitted
    if (submission.status !== 'in_progress') {
      return res.status(400).json({ message: 'Submission already completed' });
    }

    const assessment = submission.assessment as any;
    
    // Check time limit
    const timeElapsed = Math.floor((Date.now() - submission.startedAt.getTime()) / 1000);
    const maxTime = assessment.duration * 60; // Convert minutes to seconds
    
    if (timeElapsed > maxTime) {
      submission.status = 'late';
    }

    // Update submission
    submission.answers = answers;
    submission.submittedAt = new Date();
    submission.timeElapsed = timeElapsed;
    submission.status = submission.status === 'late' ? 'late' : 'submitted';

    // Auto-grade if possible
    await autoGradeSubmission(submission, assessment);

    await submission.save();

    const populatedSubmission = await Submission.findById(submission._id)
      .populate('assessment', 'title showResults')
      .populate('student', 'name email');

    res.json({
      message: 'Assessment submitted successfully',
      submission: populatedSubmission
    });
  } catch (error) {
    next(error);
  }
};

// Auto-grade submission for objective questions
const autoGradeSubmission = async (submission: any, assessment: any) => {
  let totalScore = 0;
  let maxScore = 0;

  for (const question of assessment.questions) {
    maxScore += question.points;
    
    const studentAnswer = submission.answers.find(
      (answer: any) => answer.questionId === question._id.toString()
    );

    if (!studentAnswer) continue;

    // Auto-grade based on question type
    if (question.type === 'multiple_choice' || question.type === 'true_false') {
      if (question.correctAnswer !== undefined) {
        if (studentAnswer.answer === question.correctAnswer) {
          totalScore += question.points;
        }
      }
    }
    // Short answer and essay questions need manual grading
  }

  submission.score = totalScore;
  submission.percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  
  // Check if all questions are auto-gradable
  const hasManualQuestions = assessment.questions.some(
    (q: any) => q.type === 'short_answer' || q.type === 'essay'
  );
  
  if (!hasManualQuestions) {
    submission.graded = true;
    submission.gradedAt = new Date();
  }
};

// Save assessment progress (auto-save)
export const saveProgress = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { submissionId } = req.params;
    const { answers, timeElapsed } = req.body;

    const submission = await Submission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Check if student owns this submission
    if (submission.student.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Only update if still in progress
    if (submission.status === 'in_progress') {
      submission.answers = answers;
      submission.timeElapsed = timeElapsed;
      await submission.save();
    }

    res.json({ message: 'Progress saved' });
  } catch (error) {
    next(error);
  }
};

// Get submission details
export const getSubmission = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId)
      .populate('assessment')
      .populate('student', 'name email');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Check access rights
    if (req.user.role === 'student') {
      if (submission.student._id.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role === 'teacher') {
      const assessment = submission.assessment as any;
      if (assessment.teacher.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json({ submission });
  } catch (error) {
    next(error);
  }
};

// Grade submission manually (for teachers)
export const gradeSubmission = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { submissionId } = req.params;
    const { grades, feedback } = req.body; // grades: { questionId: points }

    const submission = await Submission.findById(submissionId)
      .populate('assessment');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const assessment = submission.assessment as any;
    
    // Check if teacher owns this assessment
    if (assessment.teacher.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Calculate total score
    let totalScore = 0;
    let maxScore = 0;

    for (const question of assessment.questions) {
      maxScore += question.points;
      const questionId = question._id.toString();
      
      if (grades[questionId] !== undefined) {
        totalScore += Math.min(grades[questionId], question.points);
      }
    }

    submission.score = totalScore;
    submission.percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
    submission.graded = true;
    submission.gradedBy = req.user.id;
    submission.gradedAt = new Date();

    if (feedback) {
      (submission as any).feedback = feedback;
    }

    await submission.save();

    const populatedSubmission = await Submission.findById(submission._id)
      .populate('assessment', 'title')
      .populate('student', 'name email')
      .populate('gradedBy', 'name');

    res.json({
      message: 'Submission graded successfully',
      submission: populatedSubmission
    });
  } catch (error) {
    next(error);
  }
};

// Get student's submissions for an assessment
export const getStudentSubmissions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { assessmentId } = req.params;

    const submissions = await Submission.find({
      assessment: assessmentId,
      student: req.user.id
    })
    .populate('assessment', 'title attempts showResults')
    .sort({ attemptNumber: 1 });

    res.json({ submissions });
  } catch (error) {
    next(error);
  }
};

// Get all submissions for an assessment (for teachers)
export const getAssessmentSubmissions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { assessmentId } = req.params;

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    // Check if teacher owns this assessment
    if (assessment.teacher.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const submissions = await Submission.find({ assessment: assessmentId })
      .populate('student', 'name email')
      .sort({ submittedAt: -1 });

    res.json({ submissions });
  } catch (error) {
    next(error);
  }
};

// Get submission results with detailed feedback
export const getSubmissionResults = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId)
      .populate('assessment')
      .populate('student', 'name email');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    const assessment = submission.assessment as any;

    // Check access rights
    let canView = false;
    
    if (req.user.role === 'student') {
      // Students can only view their own results and only if results are shown
      canView = submission.student._id.toString() === req.user.id && 
               (assessment.showResults || assessment.showCorrectAnswers) &&
               submission.graded;
    } else if (req.user.role === 'teacher') {
      // Teachers can view results for their assessments
      canView = assessment.teacher.toString() === req.user.id;
    }

    if (!canView) {
      return res.status(403).json({ message: 'Results not available' });
    }

    // Prepare detailed question results
    const questionResults = assessment.questions.map((question: any) => {
      const studentAnswer = submission.answers.find(
        (answer: any) => answer.questionId === question._id.toString()
      );

      let isCorrect = false;
      let pointsEarned = 0;

      if (studentAnswer) {
        if (question.type === 'multiple_choice' || question.type === 'true_false') {
          isCorrect = studentAnswer.answer === question.correctAnswer;
          pointsEarned = isCorrect ? question.points : 0;
        }
        // For subjective questions, use graded points if available
        // This would need manual grading implementation
      }

      return {
        questionId: question._id,
        question: question.question,
        type: question.type,
        points: question.points,
        correctAnswer: req.user.role === 'teacher' || assessment.showCorrectAnswers ? 
                      question.correctAnswer : null,
        options: question.options,
        studentAnswer: studentAnswer?.answer || null,
        isCorrect,
        pointsEarned,
        feedback: question.explanation || null
      };
    });

    const results = {
      submission,
      assessment: {
        _id: assessment._id,
        title: assessment.title,
        type: assessment.type,
        description: assessment.description,
        totalPoints: assessment.questions.reduce((sum: number, q: any) => sum + q.points, 0),
        passingScore: assessment.passingScore || 0,
        showCorrectAnswers: assessment.showCorrectAnswers || req.user.role === 'teacher',
        showScore: assessment.showResults || req.user.role === 'teacher'
      },
      questionResults,
      totalScore: submission.score || 0,
      percentageScore: submission.percentage || 0,
      passed: (submission.percentage || 0) >= (assessment.passingScore || 0),
      timeSpent: submission.timeElapsed || 0
    };

    res.json(results);
  } catch (error) {
    next(error);
  }
};
