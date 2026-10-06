import express from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import cookieParser from 'cookie-parser';
import authRoute from './routes/auth.ts';
import otpRoute from './routes/otp.ts';
import courseRoute from './routes/course.ts';
import paymentRoute from './routes/payment.ts';
import reviewRoute from './routes/review.ts';
import educatorRoute from './routes/educator.ts';
import contentRoute from './routes/content.ts';
import userRoutes from './routes/user.ts';
import studentRoute from './routes/student.ts';
import adminRoute from './routes/admin.ts';
import aiRoute from './routes/ai.ts';
import { rateLimit } from './middleware/rateLimit.ts';
import { requestDiagnostics } from './middleware/requestDiagnostics.ts';

export function createApp() {
  const app = express();
  app.use(requestDiagnostics);
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use((_req, res, next) => { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); next(); });
  app.use(cors({ origin: process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:4002', credentials: true }));
  app.use('/api', rateLimit({ max: 300, windowMs: 60000 }));
  app.use('/api/v1/auth', rateLimit({ max: 30, windowMs: 600000 }));
  app.use('/api/v1/otp', rateLimit({ max: 10, windowMs: 600000 }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(fileUpload({ useTempFiles: false, limits: { fileSize: 50 * 1024 * 1024 }, abortOnLimit: true }));
  app.use(cookieParser());
  app.get('/health', (_req, res) => res.status(200).json({ status: 'OK', message: 'Server is running' }));
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/auth', authRoute);
  app.use('/api/v1/otp', otpRoute);
  app.use('/api/v1/courses', courseRoute);
  app.use('/api/v1/payments', paymentRoute);
  app.use('/api/v1/reviews', reviewRoute);
  app.use('/api/v1/educators', educatorRoute);
  app.use('/api/v1/content', contentRoute);
  app.use('/api/v1/student', studentRoute);
  app.use('/api/v1/admin', adminRoute);
  app.use('/api/v1/ai', aiRoute);
  app.use((_req, res) => res.status(404).json({ success: false, message: 'Endpoint not found' }));
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof error === 'object' && error && 'status' in error && typeof error.status === 'number' ? error.status : 500;
    res.status(status).json({ success: false, message: status < 500 ? 'Invalid request' : 'Request could not be completed' });
  });
  return app;
}

export default createApp;
