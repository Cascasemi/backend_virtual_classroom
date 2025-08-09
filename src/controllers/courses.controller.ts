import { Request, Response } from 'express';
import { Course } from '../models/Course';
import { User } from '../models/User';

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
        .populate('students', 'name email')
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
      ).populate('teacher', 'name email').populate('students', 'name email');

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
}
