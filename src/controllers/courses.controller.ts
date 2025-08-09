import { Request, Response } from 'express';
import { Course } from '../models/Course';
import { User } from '../models/User';

export class CoursesController {
  static async createCourse(req: Request, res: Response) {
    try {
      const { title, description } = req.body;
      if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
      }
      const course = await Course.create({ title, description, students: [] });
      res.json({ success: true, course });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create course' });
    }
  }

  static async getAllCourses(req: Request, res: Response) {
    try {
      const courses = await Course.find().populate('instructor', 'name email');
      res.json({ courses });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch courses' });
    }
  }

  static async assignTeacher(req: Request, res: Response) {
    try {
      const { courseId, teacherId } = req.body;
      if (!courseId || !teacherId) {
        return res.status(400).json({ error: 'Course and teacher are required' });
      }
      const course = await Course.findById(courseId);
      if (!course) return res.status(404).json({ error: 'Course not found' });
      const teacher = await User.findById(teacherId);
      if (!teacher || teacher.role !== 'teacher') return res.status(404).json({ error: 'Teacher not found' });
      course.instructor = teacher._id;
      await course.save();
      res.json({ success: true, course });
    } catch (error) {
      res.status(500).json({ error: 'Failed to assign teacher' });
    }
  }
}
