import express from 'express';
import { RequestHandler } from 'express';
import { createDoubt, replyToDoubt, getRealtimeStatus, getDoubtsByContent, getDoubts, getDoubtDetails } from '../controllers/Doubt.ts';
import { createModule, updateModule, deleteModule, getAllModules } from '../controllers/Module.ts';
import { uploadStudyMaterial, updateStudyMaterial, deleteStudyMaterial, getModuleStudyMaterials } from '../controllers/StudyMaterial.ts';
import { createCategory, updateCategory, deleteCategory, getAllCategories, getCategoryBySearch } from '../controllers/Category.ts';
import { 
    createClass, 
    getClassStream, 
    updateClass, 
    deleteClass, 
    // getAllClassesOfCourse,
    getModuleClasses
} from '../controllers/Class.ts';
import { authenticateUser } from '../controllers/Auth.ts';

const router = express.Router();

// Doubts related routes
router.post('/createDoubt', authenticateUser as unknown as RequestHandler, createDoubt as unknown as RequestHandler);
router.post('/replyToDoubt/:id', authenticateUser as unknown as RequestHandler, replyToDoubt as unknown as RequestHandler);
router.get('/doubts/content/:contentId', authenticateUser as unknown as RequestHandler, getDoubtsByContent as unknown as RequestHandler);
router.get('/doubts/:id', authenticateUser as unknown as RequestHandler, getDoubtDetails as unknown as RequestHandler);
router.get('/doubts', authenticateUser as unknown as RequestHandler, getDoubts as unknown as RequestHandler);

// New route for realtime status
router.get('/realtime-status', getRealtimeStatus as unknown as RequestHandler);

// Modules related routes
router.post('/createModule', authenticateUser as unknown as RequestHandler, createModule as unknown as RequestHandler);
router.put('/updateModule/:moduleId', authenticateUser as unknown as RequestHandler, updateModule as unknown as RequestHandler);
router.delete('/deleteModule/:moduleId', authenticateUser as unknown as RequestHandler, deleteModule as unknown as RequestHandler);
router.get('/getAllModules/:courseId', getAllModules as unknown as RequestHandler);
// Study Material related routes
router.post('/uploadStudyMaterial', authenticateUser as unknown as RequestHandler, uploadStudyMaterial as unknown as RequestHandler);
router.put('/updateStudymaterial/:materialId', authenticateUser as unknown as RequestHandler, updateStudyMaterial as unknown as RequestHandler);
router.delete('/deleteStudyMaterial/:materialId', authenticateUser as unknown as RequestHandler, deleteStudyMaterial as unknown as RequestHandler);
router.get('/getModuleStudyMaterials/:moduleId', getModuleStudyMaterials as unknown as RequestHandler);

// Category related routes
router.post('/createCategory', authenticateUser as unknown as RequestHandler, createCategory as unknown as RequestHandler);
router.put('/updateCategory/:categoryId', authenticateUser as unknown as RequestHandler, updateCategory as unknown as RequestHandler);
router.delete('/deleteCategory/:categoryId', authenticateUser as unknown as RequestHandler, deleteCategory as unknown as RequestHandler);
router.get('/getAllCategories', getAllCategories as unknown as RequestHandler);
router.get('/searchCategory', getCategoryBySearch as unknown as RequestHandler);


// Class related routes
router.post('/class/:moduleId', authenticateUser as unknown as RequestHandler, createClass as unknown as RequestHandler);
router.get('/getModuleClasses/:moduleId', authenticateUser as unknown as RequestHandler, getModuleClasses as unknown as RequestHandler);
router.get('/getClassStream/:contentId', getClassStream as unknown as RequestHandler);
router.put('/updateClass/:contentId', authenticateUser as unknown as RequestHandler, updateClass as unknown as RequestHandler);
router.delete('/deleteClass/:contentId', authenticateUser as unknown as RequestHandler, deleteClass as unknown as RequestHandler);

export default router;














