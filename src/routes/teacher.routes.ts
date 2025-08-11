import { Router } from 'express';
import { auth } from '../middleware/auth';
import mongoose from 'mongoose';
import { Course } from '../models/Course';
import { User } from '../models/User';
import { Submission } from '../models/Submission';
import { Assessment } from '../models/Assessment';

const router = Router();

// GET /api/teacher/students/performance
router.get('/students/performance', auth('teacher','admin'), async (req: any, res) => {
  try {
    const teacherId = req.user.sub || req.user.id;

    // 1. Courses taught by teacher
    const courses = await Course.find({ teacher: teacherId }, { _id: 1, students: 1 }).lean();
    const courseIds = courses.map(c => c._id);
    if (!courseIds.length) return res.json({ students: [] });

    // 2. Collect student IDs from course.students arrays
    const studentIdSet = new Set<string>();
    courses.forEach(c => (c.students || []).forEach(s => studentIdSet.add(s.toString())));
    const studentIds = Array.from(studentIdSet).map(id => new mongoose.Types.ObjectId(id));
    if (!studentIds.length) return res.json({ students: [] });

    // 3. Aggregate submissions for assessments in these courses
    const perf = await Submission.aggregate([
      { $match: { student: { $in: studentIds } } },
      { $lookup: { from: 'assessments', localField: 'assessment', foreignField: '_id', as: 'assessment' } },
      { $unwind: '$assessment' },
      { $match: { 'assessment.course': { $in: courseIds } } },
      { $group: {
          _id: '$student',
          totalScore: { $sum: { $ifNull: ['$score', 0] } },
          totalPossible: { $sum: { $ifNull: ['$assessment.totalPoints', 0] } },
          submissions: { $sum: 1 },
          breakdown: { $push: { type: '$assessment.type', score: { $ifNull: ['$score', 0] }, possible: { $ifNull: ['$assessment.totalPoints', 0] } } }
        }
      },
      { $project: {
          student: '$_id',
          _id: 0,
          submissions: 1,
          totalScore: 1,
          totalPossible: 1,
          averagePercent: { $cond: [{ $gt: ['$totalPossible', 0] }, { $multiply: [{ $divide: ['$totalScore', '$totalPossible'] }, 100] }, 0] },
          breakdown: 1
        }
      }
    ]);

    const perfMap = new Map<string, any>();
    perf.forEach(p => perfMap.set(p.student.toString(), p));

    // 4. Load students
    const students = await User.find({ _id: { $in: studentIds } }, { name: 1, email: 1 }).lean();

    const result = students.map(st => {
      const p = perfMap.get(st._id.toString());
      const typeTotals: Record<string, { s: number; p: number }> = {};
      if (p?.breakdown) {
        p.breakdown.forEach((b: any) => {
          if (!typeTotals[b.type]) typeTotals[b.type] = { s: 0, p: 0 };
          typeTotals[b.type].s += b.score;
          typeTotals[b.type].p += b.possible;
        });
      }
      const typeAverages: Record<string, number> = {};
      Object.entries(typeTotals).forEach(([k, v]) => { typeAverages[k] = v.p ? (v.s / v.p) * 100 : 0; });
      return {
        id: st._id,
        name: st.name || 'Unnamed',
        email: st.email,
        averagePercent: p?.averagePercent || 0,
        totalAssessments: p?.submissions || 0,
        typeAverages
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    res.json({ students: result });
  } catch (e:any) {
    console.error('Performance fetch error', e);
    res.status(500).json({ message: 'Failed to fetch performance' });
  }
});

export default router;