const { connectDB } = require('./dist/config/db');
const { User } = require('./dist/models/User');

(async () => {
  try {
    await connectDB();
    const teachers = await User.find({ role: 'teacher' }).select('email name role isApproved emailVerified');
    console.log('Teachers in system:', teachers);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
