import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Course } from '../models/Course';
import Session from '../models/Session';
import { Assessment } from '../models/Assessment';
import { Submission } from '../models/Submission';

interface MonthlyData {
  month: string;
  students: number;
  teachers: number;
  courses: number;
  sessions: number;
  registrations: number;
}

interface AnalyticsData {
  overview: {
    totalStudents: number;
    totalTeachers: number;
    totalCourses: number;
    activeSessions: number;
    trends: {
      students: { value: number; isPositive: boolean; period: string };
      teachers: { value: number; isPositive: boolean; period: string };
      courses: { value: number; isPositive: boolean; period: string };
      sessions: { value: number; isPositive: boolean; period: string };
    };
  };
  monthlyGrowth: MonthlyData[];
  platformUsage: {
    dailyActiveUsers: number;
    weeklySessions: number;
    avgSessionDuration: number;
    courseCompletionRate: number;
  };
  userAnalytics: {
    registrations: {
      thisMonth: number;
      lastMonth: number;
      percentageChange: number;
    };
    activity: {
      activeToday: number;
      activeThisWeek: number;
      totalUsers: number;
    };
    roles: {
      students: number;
      teachers: number;
      admins: number;
    };
  };
  courseAnalytics: {
    totalCourses: number;
    averageEnrollment: number;
    completionRates: Array<{
      courseId: string;
      courseName: string;
      enrollments: number;
      completions: number;
      completionRate: number;
    }>;
  };
  engagement: {
    averageLoginFrequency: number;
    sessionParticipation: number;
    assignmentSubmissionRate: number;
    forumActivity: number;
  };
}

export const getAnalyticsData = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Overview Statistics
    const [totalStudents, totalTeachers, totalCourses, allSessions] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'teacher' }),
      Course.countDocuments(),
      Session.find({})
    ]);

    const totalAdmins = await User.countDocuments({ role: 'admin' });

    // Calculate active (live) sessions
    const activeSessions = allSessions.filter(session => {
      const start = new Date(session.startTime);
      const end = new Date(start.getTime() + session.duration * 60000);
      return now >= start && now < end;
    }).length;

    // Historical data for trends
    const [studentsLastMonth, teachersLastMonth, coursesLastMonth] = await Promise.all([
      User.countDocuments({ role: 'student', createdAt: { $lt: currentMonth } }),
      User.countDocuments({ role: 'teacher', createdAt: { $lt: currentMonth } }),
      Course.countDocuments({ createdAt: { $lt: currentMonth } })
    ]);

    const lastMonthSessions = allSessions.filter(session => {
      const sessionDate = new Date(session.createdAt);
      return sessionDate >= lastMonth && sessionDate < currentMonth;
    }).length;

    const thisMonthSessions = allSessions.filter(session => {
      const sessionDate = new Date(session.createdAt);
      return sessionDate >= currentMonth;
    }).length;

    // Calculate trends
    const studentsTrend = studentsLastMonth > 0 ? Math.round(((totalStudents - studentsLastMonth) / studentsLastMonth) * 100) : 0;
    const teachersTrend = teachersLastMonth > 0 ? Math.round(((totalTeachers - teachersLastMonth) / teachersLastMonth) * 100) : 0;
    const coursesTrend = coursesLastMonth > 0 ? Math.round(((totalCourses - coursesLastMonth) / coursesLastMonth) * 100) : 0;
    const sessionsTrend = lastMonthSessions > 0 ? Math.round(((thisMonthSessions - lastMonthSessions) / lastMonthSessions) * 100) : 0;

    // Monthly growth data for the last 6 months
    const monthlyGrowth: MonthlyData[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      
      const [studentsCount, teachersCount, coursesCount, sessionsCount, registrationsCount] = await Promise.all([
        User.countDocuments({ role: 'student', createdAt: { $lt: monthEnd } }),
        User.countDocuments({ role: 'teacher', createdAt: { $lt: monthEnd } }),
        Course.countDocuments({ createdAt: { $lt: monthEnd } }),
        Session.countDocuments({ createdAt: { $gte: monthStart, $lt: monthEnd } }),
        User.countDocuments({ createdAt: { $gte: monthStart, $lt: monthEnd } })
      ]);

      monthlyGrowth.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        students: studentsCount,
        teachers: teachersCount,
        courses: coursesCount,
        sessions: sessionsCount,
        registrations: registrationsCount
      });
    }

    // Platform usage metrics
    const recentUsers = await User.find({ lastLoginAt: { $gte: oneDayAgo } });
    const weeklyActiveUsers = await User.find({ lastLoginAt: { $gte: oneWeekAgo } });
    const weeklySessions = allSessions.filter(session => {
      const sessionDate = new Date(session.createdAt);
      return sessionDate >= oneWeekAgo;
    }).length;

    // Calculate average session duration
    const avgSessionDuration = allSessions.length > 0 
      ? Math.round(allSessions.reduce((sum, session) => sum + session.duration, 0) / allSessions.length)
      : 0;

    // Course completion rate (simplified - based on submissions vs assessments)
    const totalAssessments = await Assessment.countDocuments();
    const totalSubmissions = await Submission.countDocuments({ status: { $in: ['submitted', 'graded'] } });
    const courseCompletionRate = totalAssessments > 0 
      ? Math.round((totalSubmissions / totalAssessments) * 100)
      : 0;

    // User analytics
    const thisMonthUsers = await User.countDocuments({ createdAt: { $gte: currentMonth } });
    const lastMonthUsers = await User.countDocuments({ 
      createdAt: { $gte: lastMonth, $lt: currentMonth } 
    });
    const registrationChange = lastMonthUsers > 0 
      ? Math.round(((thisMonthUsers - lastMonthUsers) / lastMonthUsers) * 100)
      : 0;

    // Course analytics with completion rates
    const courses = await Course.find({}).populate('students');
    const courseAnalytics = await Promise.all(
      courses.map(async (course) => {
        const courseAssessments = await Assessment.countDocuments({ course: course._id });
        const courseSubmissions = await Submission.countDocuments({ 
          assessment: { $in: await Assessment.find({ course: course._id }).select('_id') },
          status: { $in: ['submitted', 'graded'] }
        });
        
        const completionRate = courseAssessments > 0 
          ? Math.round((courseSubmissions / courseAssessments) * 100)
          : 0;

        return {
          courseId: (course as any)._id.toString(),
          courseName: (course as any).title,
          enrollments: course.students?.length || 0,
          completions: courseSubmissions,
          completionRate
        };
      })
    );

    const averageEnrollment = courses.length > 0 
      ? Math.round(courses.reduce((sum, course) => sum + (course.students?.length || 0), 0) / courses.length)
      : 0;

    // Engagement metrics
    const totalUsers = await User.countDocuments();
    const activeUsersToday = recentUsers.length;
    const activeUsersThisWeek = weeklyActiveUsers.length;
    const recentSubmissions = await Submission.countDocuments({ 
      submittedAt: { $gte: oneWeekAgo } 
    });
    const weeklyAssessments = await Assessment.countDocuments({ 
      createdAt: { $gte: oneWeekAgo } 
    });
    const submissionRate = weeklyAssessments > 0 
      ? Math.round((recentSubmissions / weeklyAssessments) * 100)
      : 0;

    const analyticsData: AnalyticsData = {
      overview: {
        totalStudents,
        totalTeachers,
        totalCourses,
        activeSessions,
        trends: {
          students: {
            value: Math.abs(studentsTrend),
            isPositive: studentsTrend >= 0,
            period: 'vs last month'
          },
          teachers: {
            value: Math.abs(teachersTrend),
            isPositive: teachersTrend >= 0,
            period: 'vs last month'
          },
          courses: {
            value: Math.abs(coursesTrend),
            isPositive: coursesTrend >= 0,
            period: 'vs last month'
          },
          sessions: {
            value: Math.abs(sessionsTrend),
            isPositive: sessionsTrend >= 0,
            period: 'vs last month'
          }
        }
      },
      monthlyGrowth,
      platformUsage: {
        dailyActiveUsers: activeUsersToday,
        weeklySessions,
        avgSessionDuration,
        courseCompletionRate
      },
      userAnalytics: {
        registrations: {
          thisMonth: thisMonthUsers,
          lastMonth: lastMonthUsers,
          percentageChange: registrationChange
        },
        activity: {
          activeToday: activeUsersToday,
          activeThisWeek: activeUsersThisWeek,
          totalUsers
        },
        roles: {
          students: totalStudents,
          teachers: totalTeachers,
          admins: totalAdmins
        }
      },
      courseAnalytics: {
        totalCourses,
        averageEnrollment,
        completionRates: courseAnalytics
      },
      engagement: {
        averageLoginFrequency: totalUsers > 0 ? Math.round((activeUsersThisWeek / totalUsers) * 100) : 0,
        sessionParticipation: Math.round((weeklySessions / Math.max(weeklyActiveUsers.length, 1)) * 100),
        assignmentSubmissionRate: submissionRate,
        forumActivity: 0 // Placeholder - would need forum/discussion models
      }
    };

    res.json({ success: true, data: analyticsData });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch analytics data' 
    });
  }
};
