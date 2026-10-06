import express from "express";
const router = express.Router();
import { authenticateUser } from '../controllers/Auth.ts';
import {
    createCourse,
    updateCourse,
    deleteCourse,
    getAllCourses,
    getSingleCourse,
    searchCourses,
    addCategory,
    getCoursesByCategory,
    getCoursesByEducator,
    checkCourseOwnership,
    checkCourseAccess,
    purchaseCourse,
    getPurchasedCourses
} from '../controllers/Course.ts';

// Protected routes (require authentication)
router.post("/create/:educatorId", authenticateUser as unknown as express.RequestHandler, createCourse as unknown as express.RequestHandler);
router.put("/update/:CourseId", authenticateUser as unknown as express.RequestHandler, updateCourse as unknown as express.RequestHandler);
router.delete("/delete/:CourseId", authenticateUser as unknown as express.RequestHandler, deleteCourse as unknown as express.RequestHandler);
router.post('/addCategory', authenticateUser as unknown as express.RequestHandler, addCategory as unknown as express.RequestHandler);

// Public routes (no authentication required)
router.get("/all", getAllCourses as unknown as express.RequestHandler); // Changed from POST to GET
router.get("/single/:id", getSingleCourse as unknown as express.RequestHandler); // Changed from POST to GET and added :id parameter
router.get('/search', searchCourses as unknown as express.RequestHandler);
 router.get('/searchByCategory', getCoursesByCategory as unknown as express.RequestHandler);
router.get('/educator/:id', getCoursesByEducator as unknown as express.RequestHandler);

// Add these new routes
router.get("/ownership/:courseId",  authenticateUser as unknown as express.RequestHandler, checkCourseOwnership as unknown as express.RequestHandler);
router.get("/access/:courseId",  authenticateUser as unknown as express.RequestHandler, checkCourseAccess as unknown as express.RequestHandler);
router.post("/purchase/:courseId",  authenticateUser as unknown as express.RequestHandler, purchaseCourse as unknown as express.RequestHandler);
router.get('/purchased', authenticateUser as express.RequestHandler, getPurchasedCourses as unknown as express.RequestHandler);

export default router;
