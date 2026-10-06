import { Request, Response } from 'express';
import { UploadedFile } from 'express-fileupload';
import { db } from '../db/index.ts';
import {  contentTable, usersTable, modulesTable, coursesTable, educatorsTable } from '../db/schema.ts';
import { eq, and, ne } from 'drizzle-orm';
import { uploadMedia, deleteMedia, getSignedMediaUrl } from '../utils/storage.ts';
import { getContentAccess, getCourseForContent, getCourseForModule, isCourseOwner, isUuid } from '../utils/access.ts';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  },
  files?: {
    material?: UploadedFile | UploadedFile[];
  };
}

// Helper function to check if user is educator
const isEducator = async (userId: string): Promise<boolean> => {
  try {
    const user = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    return user.length > 0 && user[0].isEducator;
  } catch (error) {
    console.error('Error checking educator status:', error);
    return false;
  }
};

// Helper function to validate authentication
const validateAuth = async (req: AuthenticatedRequest): Promise<{ isValid: boolean; message?: string }> => {
  if (!req.user?.id) {
    return { isValid: false, message: 'User not authenticated' };
  }
  const educatorStatus = await isEducator(req.user.id);
  if (!educatorStatus) {
    return { isValid: false, message: 'Only educators can perform this action' };
  }
  return { isValid: true };
};

// Controller for uploading study material
export const uploadStudyMaterial = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const { moduleId, title, description, order } = req.body;
    const file = req.files?.material as UploadedFile;

    if (!moduleId || !title || !file) {
      return res.status(400).json({
        success: false,
        message: 'Module ID, title and file are required'
      });
    }

    const courseId = await getCourseForModule(moduleId);
    if (!courseId || !await isCourseOwner(req.user.id, courseId)) return res.status(403).json({ success: false, message: "Course ownership required" });
    const upload = await uploadMedia(file);

    const material = await db.insert(contentTable).values({
      moduleId: moduleId,
      title: title,
      description: description || null,
      type: file.mimetype,
      fileUrl: upload.url,
      duration: file.mimetype.startsWith('video/') 
        ? req.body.duration 
          ? req.body.duration.toString() // Convert to string for numeric type
          : null 
        : null,
      order: parseInt(order) || 0,
      isPreview: Boolean(req.body.isPreview)
      // Let the defaultNow() handle timestamps
    }).returning();

    return res.status(201).json({
      success: true,
      data: material[0],
      message: "Study material uploaded successfully",
    });
  } catch (error) {
    console.error('Error in uploadStudyMaterial:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload study material'
    });
  }
};


// Controller for updating study material

export const updateStudyMaterial = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    // Validate authentication
    const authValidation = await validateAuth(req);
    if (!authValidation.isValid) {
      return res.status(401).json({
        success: false,
        message: authValidation.message
      });
    }

    // First, validate that the material belongs to the educator
    const { materialId } = req.params;
    const { title, description, order, isPreview, moduleId } = req.body;

    // First validate that the material exists and get its current module
    const existingMaterial = await db
      .select({
        material: {
          id: contentTable.id,
          fileUrl: contentTable.fileUrl,
          moduleId: contentTable.moduleId,
          courseId: modulesTable.courseId,
          educatorId: coursesTable.educatorId,
          userId: educatorsTable.userId
        },
     
       
      })
      .from(contentTable)
      .innerJoin(
        modulesTable, 
        eq(contentTable.moduleId, modulesTable.id)
      )
      .innerJoin(
        coursesTable, 
        eq(modulesTable.courseId, coursesTable.id)
      )
      .innerJoin(
        educatorsTable, 
        eq(coursesTable.educatorId, educatorsTable.id)
      )
      .innerJoin(
        usersTable, 
        eq(educatorsTable.userId, usersTable.id)
      )
      .where(eq(contentTable.id, materialId));
     

    if (!existingMaterial.length) {
      return res.status(404).json({
        success: false,
        message: 'Study material not found'
      });
    }

    // Then check if the educator owns this content
    if (existingMaterial[0].material.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to modify this content'
      });
    }

    // If trying to update moduleId, validate the new module exists
    if (moduleId) {
      const moduleExists = await db.select()
        .from(modulesTable)
        .where(eq(modulesTable.id, moduleId));

      if (!moduleExists.length || moduleExists[0].courseId !== existingMaterial[0].material.courseId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid module ID provided'
        });
      }
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date()
    };
    
    // If no moduleId provided in update, use the current one
    if (!moduleId) {
      updateData.moduleId = existingMaterial[0].material.moduleId;
    }

    // Set update fields with validation
    if (title) updateData.title = title.trim();
    if (description) updateData.description = description.trim();
    if (moduleId) updateData.moduleId = moduleId;
    if (order !== undefined) updateData.order = parseInt(order);
    if (isPreview !== undefined) updateData.isPreview = Boolean(isPreview);

    const file = req.files?.material;

    // Handle file upload if provided
    if (file) {
      const fileToUpload = Array.isArray(file) ? file[0] : file;
      
      try {
        const upload = await uploadMedia(fileToUpload);
        updateData.fileUrl = upload.url;
        updateData.type = fileToUpload.mimetype;


      } catch (uploadError) {
        return res.status(500).json({
          success: false,
          message: 'Failed to upload new file'
        });
      }
    }

    // Perform the update
    const updatedMaterial = await db.update(contentTable)
      .set(updateData)
      .where(eq(contentTable.id, materialId))
      .returning();

    if (file && existingMaterial[0].material.fileUrl) await deleteMedia(existingMaterial[0].material.fileUrl).catch(error => console.error("Old storage object cleanup failed:", error));
    return res.status(200).json({
      success: true,
      data: updatedMaterial[0],
      message: 'Study material updated successfully'
    });

  } catch (error) {
    console.error('Error in updateStudyMaterial:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update study material'
    });
  }
};

// Controller for deleting study material
export const deleteStudyMaterial = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const { materialId } = req.params;

    const material = await db.select()
      .from(contentTable)
      .where(eq(contentTable.id, materialId))
      .limit(1);

    if (!material.length) {
      return res.status(404).json({
        success: false,
        message: 'Study material not found'
      });
    }

    const courseId = await getCourseForContent(materialId);
    if (!courseId || !await isCourseOwner(req.user.id, courseId)) return res.status(403).json({ success: false, message: "Course ownership required" });
    // Delete from database
    await db.delete(contentTable)
      .where(eq(contentTable.id, materialId));
    await deleteMedia(material[0].fileUrl).catch(error => console.error("Storage cleanup failed:", error));

    return res.status(200).json({
      success: true,
      message: 'Study material deleted successfully'
    });
  } catch (error) {
    console.error('Error in deleteStudyMaterial:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete study material'
    });
  }
};

// Controller for getting study materials for a module

export const getModuleStudyMaterials = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const { moduleId } = req.params;
    
    if (!moduleId) {
      return res.status(400).json({
        success: false,
        message: 'Module ID is required'
      });
    }

    if (!isUuid(moduleId)) return res.status(400).json({ success: false, message: "Invalid module ID" });
    const courseId = await getCourseForModule(moduleId);
    if (!courseId) return res.status(404).json({ success: false, message: "Module not found" });
    if (!await getContentAccess(req.user.id, courseId)) return res.status(403).json({ success: false, message: "Access denied" });
    const materials = await db
      .select({
        id: contentTable.id,
        moduleId: contentTable.moduleId,
        title: contentTable.title,
        description: contentTable.description,
        type: contentTable.type,
        fileUrl: contentTable.fileUrl,
        duration: contentTable.duration,
        views: contentTable.views,
        order: contentTable.order,
        isPreview: contentTable.isPreview,
        createdAt: contentTable.createdAt,
        updatedAt: contentTable.updatedAt
      })
      .from(contentTable)
      .where(and(eq(contentTable.moduleId, moduleId), ne(contentTable.type, 'video')))
      .orderBy(contentTable.order);

    if (!materials || materials.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No study materials found for this module'
      });
    }

    return res.status(200).json({
      success: true,
      // Lists are metadata-only. Signing is deferred until the client opens a file.
      data: materials
    });

  } catch (error) {
    console.error('Error fetching study materials:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch study materials'
    });
  }
};

/** Issue a short-lived URL only after the caller has access to the owning course. */
export const getStudyMaterialUrl = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const { materialId } = req.params;
    if (!isUuid(materialId)) return res.status(400).json({ success: false, message: 'Invalid material ID' });
    const [material] = await db.select({ id: contentTable.id, fileUrl: contentTable.fileUrl, moduleId: contentTable.moduleId })
      .from(contentTable).where(and(eq(contentTable.id, materialId), ne(contentTable.type, 'video'))).limit(1);
    if (!material) return res.status(404).json({ success: false, message: 'Study material not found' });
    const courseId = await getCourseForModule(material.moduleId);
    if (!courseId || !await getContentAccess(req.user.id, courseId)) return res.status(403).json({ success: false, message: 'Access denied' });
    return res.json({ success: true, data: { id: material.id, fileUrl: await getSignedMediaUrl(material.fileUrl) } });
  } catch { return res.status(500).json({ success: false, message: 'Failed to sign study material URL' }); }
};

// export const moderateStudyMaterial = {
//   dismissMaterial: async (req: Request, res: Response) => {
//     try {
//       const { materialId } = req.params;
//       const { reason } = req.body;

//       const dismissedMaterial = await db
//         .update(contentTable)
//         .set({ 
          
//           dismissReason: reason,
//           dismissedAt: new Date()
//         })
//         .where(eq(contentTable.id, materialId))
//         .returning();

//       return res.status(200).json({
//         success: true,
//         message: 'Study material dismissed successfully',
//         data: dismissedMaterial[0]
//       });
//     } catch (error) {
//       return res.status(500).json({
//         success: false,
//         message: 'Error dismissing study material'
//       });
//     }
//   }
// };






