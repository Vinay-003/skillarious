import express from 'express';
import { authenticateUser } from '../controllers/Auth.ts';
import { 
  moderateUser, 
  moderateCourse, 
  moderateModule, 
  moderateContent,
  getUserAnalytics,
  getEngagementAnalytics,
  getRevenueAnalytics,
  getPlatformOverview,
  getReviewAnalytics,
  getEducatorAnalytics,
  inviteAdmin,
  registerAdmin, getAdminUsers, getAdminCourses, getAdminLogs, getAdminReports, resolveAdminReport
} from '../controllers/Admin.ts';
import { isAdmin, isSuperAdmin } from '../middleware/adminAuth.ts';
import { validateSchema } from '../middleware/validateSchema.ts';
import { adminActionSchema } from '../schemas/admin.ts';
import { logAdminAction } from '../middleware/adminLogger.ts';

const router = express.Router();
router.post('/register', registerAdmin as unknown as express.RequestHandler);
router.use(authenticateUser as unknown as express.RequestHandler);
router.use(isAdmin as unknown as express.RequestHandler);

router.get('/overview', getPlatformOverview as unknown as express.RequestHandler);
router.get('/users', getAdminUsers as unknown as express.RequestHandler);
router.get('/courses', getAdminCourses as unknown as express.RequestHandler);
router.get('/logs', getAdminLogs as unknown as express.RequestHandler);
router.get('/reports', getAdminReports as unknown as express.RequestHandler);
router.post('/reports/:reportId/resolve', resolveAdminReport as unknown as express.RequestHandler);
router.post('/moderate/course/:courseId/approve', moderateCourse.approveCourse as unknown as express.RequestHandler);

// Moderation Routes
router.post(
  '/moderate/user/:userId/ban',
  isAdmin as unknown as express.RequestHandler,
  validateSchema(adminActionSchema) as unknown as express.RequestHandler,
  logAdminAction('BAN_USER') as unknown as unknown as express.RequestHandler,
  moderateUser.banUser as unknown as unknown as express.RequestHandler
);

router.post(
  '/moderate/user/:userId/unban',
  isAdmin as unknown as express.RequestHandler,
  validateSchema(adminActionSchema) as unknown as express.RequestHandler,
  logAdminAction('UNBAN_USER') as unknown as unknown as express.RequestHandler,
  moderateUser.unbanUser as unknown as unknown as express.RequestHandler
);

router.post(
  '/moderate/course/:courseId/dismiss',
  isAdmin as unknown as express.RequestHandler,
  validateSchema(adminActionSchema) as unknown as express.RequestHandler,
  logAdminAction('DISMISS_COURSE') as unknown as unknown as express.RequestHandler,
  moderateCourse.dismissCourse as unknown as unknown as express.RequestHandler
);

router.post(
  '/moderate/module/:moduleId/dismiss',
  isAdmin as unknown as express.RequestHandler,
  validateSchema(adminActionSchema) as unknown as express.RequestHandler,
  logAdminAction('DISMISS_MODULE') as unknown as unknown as express.RequestHandler,
  moderateModule.dismissModule as unknown as unknown as express.RequestHandler
);

router.post(
  '/moderate/content/:contentId/dismiss',
  isAdmin as unknown as express.RequestHandler,
  validateSchema(adminActionSchema) as unknown as express.RequestHandler,
  logAdminAction('DISMISS_CONTENT') as unknown as unknown as express.RequestHandler,
  moderateContent.dismissContent as unknown as unknown as express.RequestHandler
);

// Analytics Routes
router.get(
  '/analytics/users',
  isAdmin as unknown as express.RequestHandler,
  getUserAnalytics as unknown as unknown as express.RequestHandler
);

router.get(
  '/analytics/engagement',
  isAdmin as unknown as express.RequestHandler,
  getEngagementAnalytics as unknown as unknown as express.RequestHandler
);

router.get(
  '/analytics/revenue',
  isAdmin as unknown as express.RequestHandler,
  getRevenueAnalytics as unknown as unknown as express.RequestHandler
);

router.get(
  '/analytics/platform-overview',
  isAdmin as unknown as express.RequestHandler,
  getPlatformOverview as unknown as unknown as express.RequestHandler
);

router.get(
  '/analytics/reviews',
  isAdmin as unknown as express.RequestHandler,
  getReviewAnalytics as unknown as unknown as express.RequestHandler
);

router.get(
  '/analytics/educators',
  isAdmin as unknown as express.RequestHandler,
  getEducatorAnalytics as unknown as unknown as express.RequestHandler
);

// Admin Management Routes
router.post(
  '/invite',
  isAdmin as unknown as express.RequestHandler,
  isSuperAdmin as unknown as express.RequestHandler,
  inviteAdmin as unknown as express.RequestHandler
);


export default router;







