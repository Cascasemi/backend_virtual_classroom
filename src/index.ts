import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db';
import { ENV } from './config/env';
import { authRouter } from './routes/auth.routes';
import { usersRouter } from './routes/users.routes';
import coursesRouter from './routes/courses.routes';
import resourcesRouter from './routes/resources.routes';
import assessmentsRouter from './routes/assessments.routes';
import sessionsRouter from './routes/sessions.routes';
import googleRoutes from './routes/google.routes';
import teacherRoutes from './routes/teacher.routes';
import dashboardRoutes from './routes/dashboard.routes';
import analyticsRoutes from './routes/analytics.routes';
import { errorHandler } from './middleware/errorHandler';

async function bootstrap() {
  await connectDB();
  const app = express();

  app.use(cors({ origin: ENV.APP_URL, credentials: true }));
  app.use(helmet());
  app.use(express.json());
  app.use(morgan('dev'));

  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
  app.use(limiter);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/courses', coursesRouter);
  app.use('/api/resources', resourcesRouter);
  app.use('/api/assessments', assessmentsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/google', googleRoutes);
  app.use('/api/teacher', teacherRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/analytics', analyticsRoutes);

  app.use(errorHandler);

  app.listen(ENV.PORT, () => console.log(`API running on port ${ENV.PORT}`));
}

bootstrap();
