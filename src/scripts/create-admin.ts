import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { User } from '../models/User';
import { ENV } from '../config/env';

async function createAdminUser() {
  try {
    await mongoose.connect(ENV.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('Admin user already exists:', existingAdmin.email);
      process.exit(0);
    }

    // Create admin user
    const adminEmail = 'admin@virtuclass.com';
    const adminPassword = 'admin123'; // Change this!
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const admin = await User.create({
      email: adminEmail,
      passwordHash,
      name: 'System Administrator',
      role: 'admin',
      emailVerified: true,
      isApproved: true
    });

    console.log('Admin user created successfully!');
    console.log('Email:', adminEmail);
    console.log('Password:', adminPassword);
    console.log('Please change the password after first login!');

  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdminUser();
