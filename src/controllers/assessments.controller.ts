import { Response, NextFunction } from 'express';
import { Assessment, IAssessment } from '../models/Assessment';
import { Submission, ISubmission } from '../models/Submission';
import { Course } from '../models/Course';
import { AuthRequest } from '../middleware/auth';

// Create assessment
export const createAssessment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      title,
      description,
      type,
      courseId,
      startDate,
      endDate,
      duration,
      attempts,
      showResults,
      shuffleQuestions,
      shuffleOptions,
      passingScore,
      questions
    } = req.body;

    // Verify the course exists and teacher has access
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (!course.teacher || course.teacher.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. You can only create assessments for your courses.' });
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    const assessment = new Assessment({
      title,
      description,
      type,
      course: courseId,
      teacher: req.user.id,
      startDate: start,
      endDate: end,
      duration,
      attempts: attempts || 1,
      showResults: showResults !== undefined ? showResults : true,
      shuffleQuestions: shuffleQuestions || false,
      shuffleOptions: shuffleOptions || false,
      passingScore,
      questions: questions || []
    });

    await assessment.save();

    const populatedAssessment = await Assessment.findById(assessment._id)
      .populate('course', 'name code')
      .populate('teacher', 'name email');

    res.status(201).json({
      message: 'Assessment created successfully',
      assessment: populatedAssessment
    });
  } catch (error) {
    next(error);
  }
};

// Get teacher's assessments
export const getTeacherAssessments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, type, courseId } = req.query;
    
    const filter: any = { 
      teacher: req.user.id,
      isActive: true
    };

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (courseId) filter.course = courseId;

    const assessments = await Assessment.find(filter)
      .populate('course', 'name code')
      .sort({ createdAt: -1 });

    res.json({ assessments });
  } catch (error) {
    next(error);
  }
};

// Get student's assessments
export const getStudentAssessments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, type } = req.query;
    
    // Find courses the student is enrolled in
    const enrolledCourses = await Course.find({ 
      students: req.user.id 
    }).select('_id');
    
    const courseIds = enrolledCourses.map(course => course._id);

    const filter: any = {
      course: { $in: courseIds },
      status: 'published',
      isActive: true
    };

    if (type) filter.type = type;

    const assessments = await Assessment.find(filter)
      .populate('course', 'name code')
      .populate('teacher', 'name')
      .sort({ startDate: 1 });

    // Get submission status for each assessment
    const assessmentsWithStatus = await Promise.all(
      assessments.map(async (assessment) => {
        const submissions = await Submission.find({
          assessment: assessment._id,
          student: req.user.id
        }).sort({ attemptNumber: -1 });

        const latestSubmission = submissions[0];
        const attemptCount = submissions.length;
        const canTakeAgain = attemptCount < assessment.attempts;
        
        // Check if assessment is currently available
        const now = new Date();
        const isAvailable = now >= assessment.startDate && now <= assessment.endDate;
        
        return {
          ...assessment.toObject(),
          latestSubmission,
          attemptCount,
          canTakeAgain,
          isAvailable
        };
      })
    );

    res.json({ assessments: assessmentsWithStatus });
  } catch (error) {
    next(error);
  }
};

// Get assessment by ID
export const getAssessmentById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const assessment = await Assessment.findById(id)
      .populate('course', 'name code')
      .populate('teacher', 'name email');

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    // Check access rights
    if (req.user.role === 'teacher') {
      if (assessment.teacher._id.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role === 'student') {
      // Check if student is enrolled in the course
      const course = await Course.findById(assessment.course._id);
      if (!course?.students.includes(req.user.id)) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      // For students, only show published assessments
      if (assessment.status !== 'published') {
        return res.status(404).json({ message: 'Assessment not found' });
      }
    }

    res.json({ assessment });
  } catch (error) {
    next(error);
  }
};

// Update assessment
export const updateAssessment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    // Check if teacher owns this assessment
    if (assessment.teacher.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Prevent editing if there are submissions (except for draft status)
    if (assessment.status !== 'draft') {
      const hasSubmissions = await Submission.countDocuments({ assessment: id });
      if (hasSubmissions > 0) {
        return res.status(400).json({ 
          message: 'Cannot edit published assessments with submissions' 
        });
      }
    }

    // Update fields
    const updates = req.body;
    if (updates.startDate && updates.endDate) {
      const start = new Date(updates.startDate);
      const end = new Date(updates.endDate);
      if (start >= end) {
        return res.status(400).json({ message: 'End date must be after start date' });
      }
    }

    const updatedAssessment = await Assessment.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('course', 'name code');

    res.json({
      message: 'Assessment updated successfully',
      assessment: updatedAssessment
    });
  } catch (error) {
    next(error);
  }
};

// Delete assessment
export const deleteAssessment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    // Check if teacher owns this assessment
    if (assessment.teacher.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Soft delete
    assessment.isActive = false;
    await assessment.save();

    res.json({ message: 'Assessment deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Publish assessment
export const publishAssessment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    // Check if teacher owns this assessment
    if (assessment.teacher.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Validate assessment before publishing
    if (assessment.questions.length === 0) {
      return res.status(400).json({ message: 'Cannot publish assessment without questions' });
    }

    assessment.status = 'published';
    await assessment.save();

    res.json({
      message: 'Assessment published successfully',
      assessment
    });
  } catch (error) {
    next(error);
  }
};

// Unpublish assessment (revert to draft)
export const unpublishAssessment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }
    if (assessment.teacher.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (assessment.status !== 'published') {
      return res.status(400).json({ message: 'Only published assessments can be unpublished' });
    }
    const submissionCount = await Submission.countDocuments({ assessment: id });
    if (submissionCount > 0) {
      return res.status(400).json({ message: 'Cannot unpublish: submissions already exist' });
    }
    assessment.status = 'draft';
    await assessment.save();
    res.json({ message: 'Assessment reverted to draft', assessment });
  } catch (error) {
    next(error);
  }
};

// Get assessment statistics
export const getAssessmentStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const assessment = await Assessment.findById(id);
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    // Check if teacher owns this assessment
    if (assessment.teacher.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const submissions = await Submission.find({ assessment: id })
      .populate('student', 'name email');

    const totalSubmissions = submissions.length;
    const gradedSubmissions = submissions.filter(s => s.graded);
    const averageScore = gradedSubmissions.length > 0 
      ? gradedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / gradedSubmissions.length 
      : 0;

    const stats = {
      totalSubmissions,
      gradedSubmissions: gradedSubmissions.length,
      pendingGrading: totalSubmissions - gradedSubmissions.length,
      averageScore: Math.round(averageScore * 100) / 100,
      submissions: submissions.map(s => ({
        student: s.student,
        score: s.score,
        percentage: s.percentage,
        status: s.status,
        submittedAt: s.submittedAt,
        attemptNumber: s.attemptNumber
      }))
    };

    res.json({ stats });
  } catch (error) {
    next(error);
  }
};

// Start assessment (for students)
export const startAssessment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const assessment = await Assessment.findById(id).populate('course');
    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    // Check if student is enrolled
    const course = assessment.course as any;
    if (!course.students.includes(req.user.id)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if assessment is available
    const now = new Date();
    if (now < assessment.startDate || now > assessment.endDate) {
      return res.status(400).json({ message: 'Assessment is not currently available' });
    }

    if (assessment.status !== 'published') {
      return res.status(400).json({ message: 'Assessment is not published' });
    }

    // Check attempt limit
    const previousAttempts = await Submission.countDocuments({
      assessment: id,
      student: req.user.id
    });

    if (previousAttempts >= assessment.attempts) {
      return res.status(400).json({ message: 'Maximum attempts exceeded' });
    }

    // Check for existing in-progress submission
    const inProgressSubmission = await Submission.findOne({
      assessment: id,
      student: req.user.id,
      status: 'in_progress'
    });

    if (inProgressSubmission) {
      return res.json({
        message: 'Assessment already in progress',
        submission: inProgressSubmission
      });
    }

    // Create new submission
    const submission = new Submission({
      assessment: id,
      student: req.user.id,
      attemptNumber: previousAttempts + 1,
      startedAt: new Date()
    });

    await submission.save();

    // Return assessment questions (shuffled if needed)
    let questions = [...assessment.questions];
    if (assessment.shuffleQuestions) {
      questions = questions.sort(() => Math.random() - 0.5);
    }

    if (assessment.shuffleOptions) {
      questions = questions.map(q => ({
        ...q.toObject(),
        options: q.options ? [...q.options].sort(() => Math.random() - 0.5) : q.options
      }));
    }

    res.json({
      message: 'Assessment started successfully',
      submission,
      assessment: {
        ...assessment.toObject(),
        questions
      }
    });
  } catch (error) {
    next(error);
  }
};
