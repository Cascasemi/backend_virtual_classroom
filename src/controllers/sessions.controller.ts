import { Request, Response } from 'express';
import Session from '../models/Session';
import { Course } from '../models/Course';
import { User } from '../models/User';
// import { createGoogleMeetSession } from '../services/googleMeet.service';
import { createMeetEvent } from '../services/googleCalendar.service';
import { AuthRequest } from '../middleware/auth';

export const createSession = async (req: AuthRequest, res: Response) => {
  try {
    const { title, courseId, startTime, duration, description } = req.body;
    const teacherId = req.user!.sub;

    // Validate required fields
    if (!title || !courseId || !startTime || !duration) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: title, courseId, startTime, duration' 
      });
    }

    // Validate the course exists and teacher has access
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Check if teacher is assigned to this course (for teachers)
    if (req.user!.role === 'teacher' && course.teacher?.toString() !== teacherId) {
      return res.status(403).json({ success: false, message: 'You are not authorized to create sessions for this course' });
    }

    // Validate start time is in the future
    const startDateTime = new Date(startTime);
    if (startDateTime <= new Date()) {
      return res.status(400).json({ success: false, message: 'Start time must be in the future' });
    }

    // Validate duration
    if (duration < 5 || duration > 480) {
      return res.status(400).json({ success: false, message: 'Duration must be between 5 and 480 minutes' });
    }

    // Get teacher refresh token
    const teacher = await User.findById(teacherId);
    if (!teacher?.googleRefreshToken) {
      return res.status(400).json({ success: false, message: 'Google not connected for this teacher' });
    }

    // Create real Google Meet via Calendar
    let meetUrl = '';
    let meetingId = '';
    try {
      const meet = await createMeetEvent({
        refreshToken: teacher.googleRefreshToken,
        summary: title,
        description,
        start: startDateTime,
        durationMinutes: duration
      });
      meetUrl = meet.meetUrl;
      meetingId = meet.eventId;
    } catch (e:any) {
      console.error('Calendar create error', e);
      return res.status(500).json({ success: false, message: 'Failed to create Google Meet event' });
    }

    // Create session in database
    const session = new Session({
      title,
      course: courseId,
      teacher: teacherId,
      meetingId,
      meetingUrl: meetUrl,
      startTime: startDateTime,
      duration,
      status: 'scheduled'
    });

    await session.save();

    // Populate the response
    const populatedSession = await Session.findById(session._id)
      .populate('course', 'name code')
      .populate('teacher', 'name email');

    res.status(201).json({ success: true, session: populatedSession, message: 'Session created successfully' });
  } catch (error: any) {
    console.error('Create session error:', error);
    res.status(500).json({ success: false, message: 'Failed to create session' });
  }
};

export const listSessions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.sub;
    const userRole = req.user!.role;
    let filter: any = {};

    if (userRole === 'teacher') {
      // Teachers see their own sessions
      filter.teacher = userId;
    } else if (userRole === 'student') {
      // Students see sessions for courses they're enrolled in
      const user = await User.findById(userId);
      if (user) {
        // Find courses where student is enrolled
        const enrolledCourses = await Course.find({ 
          students: userId, 
          isActive: true 
        }).select('_id');
        
        filter.course = { $in: enrolledCourses.map(c => c._id) };
      }
    }
    // Admins see all sessions (no filter)

    const sessions = await Session.find(filter)
      .populate('course', 'name code')
      .populate('teacher', 'name email')
      .sort({ startTime: 1 });

    res.json({
      success: true,
      sessions
    });
  } catch (error: any) {
    console.error('List sessions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch sessions' 
    });
  }
};

export const getSession = async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user!.sub;
    const userRole = req.user!.role;

    const session = await Session.findById(sessionId)
      .populate('course', 'name code')
      .populate('teacher', 'name email')
      .populate('participants.user', 'name email');

    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }

    // Check access permissions
    if (userRole === 'teacher' && session.teacher._id.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to view this session' 
      });
    }

    if (userRole === 'student') {
      // Check if student is enrolled in the course
      const course = await Course.findById(session.course._id);
      if (!course || !course.students.includes(userId)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Not authorized to view this session' 
        });
      }
    }

    res.json({
      success: true,
      session
    });
  } catch (error: any) {
    console.error('Get session error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch session' 
    });
  }
};

export const joinSession = async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user!.sub;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }

    // For students, check if they're enrolled in the course
    if (req.user!.role === 'student') {
      const course = await Course.findById(session.course);
      if (!course || !course.students.includes(userId)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Not enrolled in this course' 
        });
      }
    }

    // Check if user already joined
    const existingParticipant = session.participants.find(
      (p: any) => p.user.toString() === userId
    );

    if (!existingParticipant) {
      // Add new participant
      session.participants.push({
        user: userId,
        joinedAt: new Date()
      });
      await session.save();
    }

    res.json({
      success: true,
      message: 'Joined session successfully',
      meetingUrl: session.meetingUrl
    });
  } catch (error: any) {
    console.error('Join session error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to join session' 
    });
  }
};

export const updateSessionStatus = async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.id;
    const { status } = req.body;
    const userId = req.user!.sub;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }

    // Only teacher or admin can update status
    if (req.user!.role === 'teacher' && session.teacher.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to update this session' 
      });
    }

    if (!['scheduled', 'live', 'ended', 'cancelled'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status value' 
      });
    }

    session.status = status;
    await session.save();

    res.json({
      success: true,
      session,
      message: 'Session status updated successfully'
    });
  } catch (error: any) {
    console.error('Update session status error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update session status' 
    });
  }
};

export const deleteSession = async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user!.sub;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Session not found' 
      });
    }

    // Only teacher who created the session or admin can delete
    if (req.user!.role === 'teacher' && session.teacher.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to delete this session' 
      });
    }

    await Session.findByIdAndDelete(sessionId);

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete session error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete session' 
    });
  }
};
