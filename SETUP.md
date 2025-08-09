## Virtual Classroom Backend Setup

### Features Implemented:

1. **User Registration with Role-based Approval**
   - Students: Auto-approved after email verification
   - Teachers: Require admin approval after email verification
   - Admins: Auto-approved (created via script)

2. **Authentication System**
   - JWT-based authentication with access and refresh tokens
   - Password hashing with bcrypt
   - Email verification system
   - Role-based access control

3. **API Endpoints**

#### Public Endpoints:
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/verify-email` - Email verification
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset
- `POST /api/auth/logout` - User logout

#### Admin-only Endpoints:
- `GET /api/auth/pending-teachers` - Get teachers waiting for approval
- `PUT /api/auth/approve-teacher/:teacherId` - Approve a teacher
- `DELETE /api/auth/reject-teacher/:teacherId` - Reject a teacher

### Setup Instructions:

1. **Install Dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Create Admin User:**
   ```bash
   npm run create-admin
   ```
   Default admin credentials:
   - Email: admin@virtuclass.com
   - Password: admin123

3. **Start Development Server:**
   ```bash
   npm run dev
   ```

### Environment Variables:
The `.env` file has been created with your MongoDB Atlas connection string.

### Database Schema:
- Users have `isApproved` field that defaults to `true` for students/admins, `false` for teachers
- Teachers must be approved by an admin before they can log in
- All users must verify their email before logging in

### Next Steps:
1. Configure email settings in `.env` for email verification
2. Test the registration and login flow
3. Implement frontend integration with role-based routing
