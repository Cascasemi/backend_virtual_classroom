import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Course } from '../models/Course';
import Session from '../models/Session';
import { Assessment } from '../models/Assessment';
import { Submission } from '../models/Submission';

interface DashboardStats {
  totalCourses: number;
  totalStudents: number;
  totalTeachers: number;
  activeSessions: number;
  pendingAssignments: number;
  averageGrade: number;
  systemNotices?: number;
  trends: {
    courses: { value: number; isPositive: boolean; period: string };
    students: { value: number; isPositive: boolean; period: string };
    teachers: { value: number; isPositive: boolean; period: string };
    sessions: { value: number; isPositive: boolean; period: string };
    assignments: { value: number; isPositive: boolean; period: string };
    grades: { value: number; isPositive: boolean; period: string };
  };
}

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const userRole = req.user!.role;
    const userId = req.user!.sub;
    
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let stats: Partial<DashboardStats> = {};

    if (userRole === 'admin') {
      // Admin sees system-wide statistics
      const [
        totalCourses,
        coursesLastMonth,
        totalStudents,
        studentsLastMonth,
        totalTeachers,
        teachersLastMonth,
        allSessions,
        sessionsLastWeek,
        allAssessments,
        assessmentsLastWeek,
        allSubmissions
      ] = await Promise.all([
        Course.countDocuments({ isActive: true }),
        Course.countDocuments({ isActive: true, createdAt: { $lt: lastMonth } }),
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: 'student', createdAt: { $lt: lastMonth } }),
        User.countDocuments({ role: 'teacher' }),
        User.countDocuments({ role: 'teacher', createdAt: { $lt: lastMonth } }),
        Session.find(),
        Session.countDocuments({ createdAt: { $gte: lastWeek } }),
        Assessment.countDocuments({ status: 'published', isActive: true }),
        Assessment.countDocuments({ status: 'published', isActive: true, createdAt: { $gte: lastWeek } }),
        Submission.find({ graded: true }).populate('assessment')
      ]);

      // Calculate active sessions (live based on time)
      const activeSessions = allSessions.filter(session => {
        const start = new Date(session.startTime);
        const end = new Date(start.getTime() + session.duration * 60000);
        return now >= start && now < end;
      }).length;

      // Calculate average grade
      const gradedSubmissions = allSubmissions.filter(s => s.percentage !== undefined);
      const averageGrade = gradedSubmissions.length > 0 
        ? Math.round(gradedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / gradedSubmissions.length)
        : 0;

      // Calculate growth percentages
      const courseGrowth = coursesLastMonth > 0 
        ? Math.round(((totalCourses - coursesLastMonth) / coursesLastMonth) * 100)
        : totalCourses > 0 ? 100 : 0;

      const studentGrowth = studentsLastMonth > 0 
        ? Math.round(((totalStudents - studentsLastMonth) / studentsLastMonth) * 100)
        : totalStudents > 0 ? 100 : 0;

      const teacherGrowth = teachersLastMonth > 0 
        ? Math.round(((totalTeachers - teachersLastMonth) / teachersLastMonth) * 100)
        : totalTeachers > 0 ? 100 : 0;

      stats = {
        totalCourses,
        totalStudents,
        totalTeachers,
        activeSessions,
        pendingAssignments: allAssessments,
        averageGrade,
        systemNotices: 0,
        trends: {
          courses: { value: Math.abs(courseGrowth), isPositive: courseGrowth >= 0, period: 'vs last month' },
          students: { value: Math.abs(studentGrowth), isPositive: studentGrowth >= 0, period: 'vs last month' },
          teachers: { value: Math.abs(teacherGrowth), isPositive: teacherGrowth >= 0, period: 'vs last month' },
          sessions: { value: sessionsLastWeek, isPositive: true, period: 'this week' },
          assignments: { value: assessmentsLastWeek, isPositive: true, period: 'this week' },
          grades: { value: Math.abs(averageGrade), isPositive: averageGrade >= 75, period: 'system average' }
        }
      };

    } else if (userRole === 'teacher') {
      // Teacher sees their course statistics
      const teacherCourses = await Course.find({ teacher: userId, isActive: true });
      const courseIds = teacherCourses.map(c => c._id);
      
      const [
        teacherAssessments,
        assessmentsLastWeek,
        teacherSessions,
        sessionsLastWeek,
        submissions
      ] = await Promise.all([
        Assessment.countDocuments({ teacher: userId, isActive: true }),
        Assessment.countDocuments({ teacher: userId, isActive: true, createdAt: { $gte: lastWeek } }),
        Session.find({ teacher: userId }),
        Session.countDocuments({ teacher: userId, createdAt: { $gte: lastWeek } }),
        Submission.find({ 
          assessment: { $in: await Assessment.find({ teacher: userId }).select('_id') }
        }).populate('assessment')
      ]);

      // Get unique students across all teacher's courses
      const uniqueStudents = new Set();
      teacherCourses.forEach(course => {
        course.students.forEach(student => uniqueStudents.add(student.toString()));
      });

      // Calculate active sessions
      const activeSessions = teacherSessions.filter(session => {
        const start = new Date(session.startTime);
        const end = new Date(start.getTime() + session.duration * 60000);
        return now >= start && now < end;
      }).length;

      // Calculate average grade for teacher's assessments
      const gradedSubmissions = submissions.filter(s => s.graded && s.percentage !== undefined);
      const averageGrade = gradedSubmissions.length > 0 
        ? Math.round(gradedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / gradedSubmissions.length)
        : 0;

      stats = {
        totalCourses: teacherCourses.length,
        totalStudents: uniqueStudents.size,
        activeSessions,
        pendingAssignments: teacherAssessments,
        averageGrade,
        trends: {
          courses: { value: teacherCourses.length, isPositive: true, period: 'assigned' },
          students: { value: uniqueStudents.size, isPositive: true, period: 'enrolled' },
          teachers: { value: 0, isPositive: true, period: '' },
          sessions: { value: sessionsLastWeek, isPositive: true, period: 'this week' },
          assignments: { value: assessmentsLastWeek, isPositive: true, period: 'this week' },
          grades: { value: Math.abs(averageGrade), isPositive: averageGrade >= 75, period: 'class average' }
        }
      };

    } else if (userRole === 'student') {
      // Student sees their personal statistics
      const enrolledCourses = await Course.find({ students: userId, isActive: true });
      const courseIds = enrolledCourses.map(c => c._id);
      
      const [
        availableAssessments,
        studentSessions,
        studentSubmissions
      ] = await Promise.all([
        Assessment.find({ 
          course: { $in: courseIds }, 
          status: 'published', 
          isActive: true 
        }),
        Session.find({ course: { $in: courseIds } }),
        Submission.find({ student: userId }).populate('assessment')
      ]);

      // Calculate pending assignments
      const pendingAssessments = availableAssessments.filter(assessment => {
        const hasSubmission = studentSubmissions.some(sub => 
          sub.assessment && 
          (sub.assessment as any)._id.toString() === (assessment as any)._id.toString() && 
          (sub.status === 'submitted' || sub.status === 'graded')
        );
        const isBeforeDeadline = new Date(assessment.endDate) > now;
        return !hasSubmission && isBeforeDeadline;
      }).length;

      // Calculate active sessions
      const activeSessions = studentSessions.filter(session => {
        const start = new Date(session.startTime);
        const end = new Date(start.getTime() + session.duration * 60000);
        return now >= start && now < end;
      }).length;

      // Calculate average grade
      const gradedSubmissions = studentSubmissions.filter(s => s.graded && s.percentage !== undefined);
      const averageGrade = gradedSubmissions.length > 0 
        ? Math.round(gradedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / gradedSubmissions.length)
        : 0;

      // Calculate improvement trend (last 5 submissions vs previous 5)
      const recentSubmissions = gradedSubmissions
        .filter(s => s.submittedAt)
        .sort((a, b) => new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime())
        .slice(0, 10);
      
      let gradeTrend = 0;
      if (recentSubmissions.length >= 4) {
        const recent = recentSubmissions.slice(0, Math.floor(recentSubmissions.length / 2));
        const older = recentSubmissions.slice(Math.floor(recentSubmissions.length / 2));
        const recentAvg = recent.reduce((sum, s) => sum + (s.percentage || 0), 0) / recent.length;
        const olderAvg = older.reduce((sum, s) => sum + (s.percentage || 0), 0) / older.length;
        gradeTrend = Math.round(recentAvg - olderAvg);
      }

      stats = {
        totalCourses: enrolledCourses.length,
        activeSessions,
        pendingAssignments: pendingAssessments,
        averageGrade,
        trends: {
          courses: { value: enrolledCourses.length, isPositive: true, period: 'enrolled' },
          students: { value: 0, isPositive: true, period: '' },
          teachers: { value: 0, isPositive: true, period: '' },
          sessions: { value: activeSessions, isPositive: true, period: 'live now' },
          assignments: { value: pendingAssessments, isPositive: false, period: 'pending' },
          grades: { value: Math.abs(gradeTrend), isPositive: gradeTrend >= 0, period: 'recent trend' }
        }
      };
    }

    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch dashboard statistics' 
    });
  }
};
