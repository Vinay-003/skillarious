import express from 'express';
import { authenticateUser } from '../controllers/Auth.js';
import { listHistory, recordHistory, listLikes, setLike, removeLike, listPlaylists, createPlaylist, deletePlaylist, addPlaylistCourse, removePlaylistCourse, listSubscriptions, setSubscription, removeSubscription } from '../controllers/Library.js';
import {
  // getStudentDashboard,
  // getStudentProgress
  getEnrolledCourses
} from '../controllers/Student.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateUser as express.RequestHandler);
router.get('/history', listHistory as unknown as express.RequestHandler);
router.put('/history/:courseId', recordHistory as unknown as express.RequestHandler);
router.get('/likes', listLikes as unknown as express.RequestHandler);
router.put('/likes/:courseId', setLike as unknown as express.RequestHandler);
router.delete('/likes/:courseId', removeLike as unknown as express.RequestHandler);
router.get('/playlists', listPlaylists as unknown as express.RequestHandler);
router.post('/playlists', createPlaylist as unknown as express.RequestHandler);
router.delete('/playlists/:playlistId', deletePlaylist as unknown as express.RequestHandler);
router.put('/playlists/:playlistId/courses/:courseId', addPlaylistCourse as unknown as express.RequestHandler);
router.delete('/playlists/:playlistId/courses/:courseId', removePlaylistCourse as unknown as express.RequestHandler);
router.get('/subscriptions', listSubscriptions as unknown as express.RequestHandler);
router.put('/subscriptions/:educatorId', setSubscription as unknown as express.RequestHandler);
router.delete('/subscriptions/:educatorId', removeSubscription as unknown as express.RequestHandler);

// // Dashboard routes
// router.get(
//   '/dashboard',
//   getStudentDashboard as unknown as express.RequestHandler
// );

// // Progress routes
// router.get(
//   '/progress/:courseId',
//   getStudentProgress as unknown as express.RequestHandler
// );

router.get(
  '/enrolledCourses',
  getEnrolledCourses as unknown as express.RequestHandler
);

export default router;


