import { Request, Response } from 'express';
import { Course } from '../models/Course';
import { User } from '../models/User';
import { Module, Lesson } from '../models/Content';

export class CoursesController {
  static async getAllCourses(req: Request, res: Response) {
    try {
      let currentUser: any = (req as any).user;
      if (!currentUser) {
        // fallback attempt (should be handled by auth middleware)
        currentUser = {};
      }
      const filter: any = { isActive: true };
      if (currentUser?.role === 'teacher') {
        filter.teacher = currentUser.sub; // only courses assigned to this teacher
      }
      const courses = await Course.find(filter)
        .populate('teacher', 'name email')
        .populate('students', 'name email classCode')
        .sort({ yearGroup: 1, name: 1 });
      
      res.json({ courses });
    } catch (error) {
      console.error('Get courses error:', error);
      res.status(500).json({ error: 'Failed to fetch courses' });
    }
  }

  static async createCourse(req: Request, res: Response) {
    try {
      const { name, code, yearGroup, teacherId, description } = req.body;
      
      if (!name || !code || !yearGroup) {
        return res.status(400).json({ error: 'Course name, code, and year group are required' });
      }

      if (yearGroup < 1 || yearGroup > 6) {
        return res.status(400).json({ error: 'Year group must be between 1 and 6' });
      }

      // Check if teacher exists and is approved
      if (teacherId) {
        const teacher = await User.findById(teacherId);
        if (!teacher || teacher.role !== 'teacher' || !teacher.isApproved) {
          return res.status(400).json({ error: 'Invalid or unapproved teacher selected' });
        }
      }

      // Check for duplicate course code within the same year group
      const existingCourse = await Course.findOne({ 
        code: code.toUpperCase(), 
        yearGroup,
        isActive: true 
      });
      
      if (existingCourse) {
        return res.status(400).json({ 
          error: `Course code ${code.toUpperCase()} already exists for Year ${yearGroup}` 
        });
      }

      const course = await Course.create({
        name,
        code: code.toUpperCase(),
        yearGroup,
        teacher: teacherId || null,
        description: description || '',
        students: []
      });

      // Populate teacher data for response
      await course.populate('teacher', 'name email');

      res.status(201).json({ 
        success: true, 
        course,
        message: 'Course created successfully' 
      });
    } catch (error) {
      console.error('Create course error:', error);
      res.status(500).json({ error: 'Failed to create course' });
    }
  }

  static async updateCourse(req: Request, res: Response) {
    try {
      const { courseId } = req.params;
      const { name, code, yearGroup, teacherId, description } = req.body;

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      // Check if teacher exists and is approved
      if (teacherId) {
        const teacher = await User.findById(teacherId);
        if (!teacher || teacher.role !== 'teacher' || !teacher.isApproved) {
          return res.status(400).json({ error: 'Invalid or unapproved teacher selected' });
        }
      }

      // Check for duplicate course code (excluding current course)
      if (code && code !== course.code) {
        const existingCourse = await Course.findOne({ 
          code: code.toUpperCase(), 
          yearGroup: yearGroup || course.yearGroup,
          isActive: true,
          _id: { $ne: courseId }
        });
        
        if (existingCourse) {
          return res.status(400).json({ 
            error: `Course code ${code.toUpperCase()} already exists for Year ${yearGroup || course.yearGroup}` 
          });
        }
      }

      // Update course
      const updatedCourse = await Course.findByIdAndUpdate(
        courseId,
        {
          name: name || course.name,
          code: code ? code.toUpperCase() : course.code,
          yearGroup: yearGroup || course.yearGroup,
          teacher: teacherId !== undefined ? (teacherId || null) : course.teacher,
          description: description !== undefined ? description : course.description
        },
        { new: true }
      ).populate('teacher', 'name email').populate('students', 'name email classCode');

      res.json({ 
        success: true, 
        course: updatedCourse,
        message: 'Course updated successfully' 
      });
    } catch (error) {
      console.error('Update course error:', error);
      res.status(500).json({ error: 'Failed to update course' });
    }
  }

  static async deleteCourse(req: Request, res: Response) {
    try {
      const { courseId } = req.params;

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      // Soft delete by marking as inactive
      await Course.findByIdAndUpdate(courseId, { isActive: false });

      res.json({ 
        success: true, 
        message: 'Course deleted successfully' 
      });
    } catch (error) {
      console.error('Delete course error:', error);
      res.status(500).json({ error: 'Failed to delete course' });
    }
  }

  static async getAvailableTeachers(req: Request, res: Response) {
    try {
      const teachers = await User.find({
        role: 'teacher',
        isApproved: true,
        emailVerified: true
      }).select('name email').sort({ name: 1 });

      res.json({ teachers });
    } catch (error) {
      console.error('Get teachers error:', error);
      res.status(500).json({ error: 'Failed to fetch teachers' });
    }
  }

  static async updateEnrollments(req: Request, res: Response) {
    try {
      const userPayload: any = (req as any).user;
      if (!userPayload) return res.status(401).json({ error: 'Unauthorized' });
      const { courseId } = req.params;
      const { studentIds } = req.body as { studentIds: string[] };
      if (!Array.isArray(studentIds)) return res.status(400).json({ error: 'studentIds array required' });

      const course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ error: 'Course not found' });

      // Only admin or assigned teacher can modify
      if (userPayload.role !== 'admin' && (!course.teacher || course.teacher.toString() !== userPayload.sub)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Validate students exist
      const students = await User.find({ _id: { $in: studentIds }, role: 'student' }).select('_id');
      const validIds = students.map((s: any) => s._id.toString());
      course.students = validIds as any;
      await course.save();
      await course.populate('teacher', 'name email');
      await course.populate('students', 'name email classCode');
      res.json({ success: true, course });
    } catch (error) {
      console.error('Update enrollments error:', error);
      res.status(500).json({ error: 'Failed to update enrollments' });
    }
  }

  static async selfEnroll(req: Request, res: Response) {
    try {
      const payload: any = (req as any).user;
      if (!payload) return res.status(401).json({ error: 'Unauthorized' });
      if (payload.role !== 'student') return res.status(403).json({ error: 'Forbidden' });
      const { courseId } = req.params;
      const course = await Course.findById(courseId).populate('students', 'name email classCode');
      if (!course) return res.status(404).json({ error: 'Course not found' });
      // Load student to read classCode
      const student = await User.findById(payload.sub).select('classCode');
      if (!student) return res.status(404).json({ error: 'User not found' });
      if (!student.classCode) return res.status(400).json({ error: 'Set your class code before enrolling' });
      const prefix = course.code.slice(0,3).toUpperCase();
      if (student.classCode.toUpperCase() !== prefix) {
        return res.status(400).json({ error: 'Class code does not match course code prefix' });
      }
      const already = course.students.some((s: any) => s._id.toString() === payload.sub);
      if (!already) {
        course.students.push(student._id as any);
        await course.save();
        await course.populate('students', 'name email classCode');
      }
      await course.populate('teacher', 'name email');
      res.json({ success: true, course });
    } catch (error) {
      console.error('Self enroll error:', error);
      res.status(500).json({ error: 'Failed to enroll' });
    }
  }

  static async createModule(req: Request, res: Response) {
    try {
      const payload: any = (req as any).user;
      const { courseId } = req.params;
      const { title, description } = req.body;
      if (!title) return res.status(400).json({ error: 'Title required' });
      const course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ error: 'Course not found' });
      if (payload.role !== 'admin' && (!course.teacher || course.teacher.toString() !== payload.sub)) return res.status(403).json({ error: 'Forbidden' });
      const count = await Module.countDocuments({ course: courseId });
      const mod = await Module.create({ course: courseId, title, description, order: count });
      res.status(201).json({ success: true, module: mod });
    } catch (error) {
      console.error('Create module error:', error);
      res.status(500).json({ error: 'Failed to create module' });
    }
  }

  static async upsertLesson(req: Request, res: Response) {
    try {
      const payload: any = (req as any).user;
      const { courseId, moduleId, lessonId } = req.params as any;
      const { title, content, images, videoUrl, quiz } = req.body;
      const course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ error: 'Course not found' });
      if (payload.role !== 'admin' && (!course.teacher || course.teacher.toString() !== payload.sub)) return res.status(403).json({ error: 'Forbidden' });
      const mod = await Module.findOne({ _id: moduleId, course: courseId });
      if (!mod) return res.status(404).json({ error: 'Module not found' });
      let lesson;
      if (lessonId && lessonId !== 'new') {
        lesson = await Lesson.findOneAndUpdate({ _id: lessonId, module: moduleId }, { title, content, images, videoUrl, quiz }, { new: true });
      } else {
        const count = await Lesson.countDocuments({ module: moduleId });
        lesson = await Lesson.create({ module: moduleId, course: courseId, title, content, images: images || [], videoUrl, quiz, order: count });
        mod.lessons.push(lesson._id as any);
        await mod.save();
      }
      res.json({ success: true, lesson });
    } catch (error) {
      console.error('Upsert lesson error:', error);
      res.status(500).json({ error: 'Failed to save lesson' });
    }
  }

  static async getContent(req: Request, res: Response) {
    try {
      const { courseId } = req.params;
      const modules = await Module.find({ course: courseId }).sort({ order: 1 }).populate({ path: 'lessons', options: { sort: { order: 1 } } });
      res.json({ modules });
    } catch (error) {
      console.error('Get content error:', error);
      res.status(500).json({ error: 'Failed to load content' });
    }
  }
}
