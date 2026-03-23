import { Request, Response } from 'express';
import { db } from '../db/index.ts';
import { modulesTable, coursesTable, educatorsTable,usersTable } from '../db/schema.ts';
import { eq, and } from 'drizzle-orm';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  }
}

// controller for creating module
export const createModule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.user;
    const { courseId, name, duration, videoCount, materialCount } = req.body;

    if(!id){
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Validate required fields
    if (!courseId || !name) {
      res.status(400).json({
        success: false,
        message: 'Course ID and name are required'
      });
      return;
    }

    // Check if course exists
    const courseExists = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId));

    if (!courseExists.length) {
      res.status(404).json({
        success: false,
        message: 'Course not found'
      });
      return;
    }

    const isEducator = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .then((data) => data[0].isEducator);

    if (!isEducator) {
      res.status(403).json({
        success: false,
        message: 'Only authenticated educators can create modules'
      });
      return;
    }

    const educatorProfile = await db
      .select({ id: educatorsTable.id })
      .from(educatorsTable)
      .where(eq(educatorsTable.userId, id))
      .limit(1);

    if (!educatorProfile.length) {
      res.status(403).json({
        success: false,
        message: 'Educator profile not found'
      });
      return;
    }

    // Verify the course belongs to this educator
    const courseOwnership = await db
      .select({ id: coursesTable.id })
      .from(coursesTable)
      .where(and(
        eq(coursesTable.id, courseId),
        eq(coursesTable.educatorId, educatorProfile[0].id)
      ))
      .limit(1);

    if (!courseOwnership.length) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to add modules to this course'
      });
      return;
    }

    // Create new module
    const newModule = await db.insert(modulesTable)
      .values({
        courseId,
        name,
        duration: duration || null,
        videoCount: videoCount || 0,
        materialCount: materialCount || 0
      })
      .returning();

    res.status(201).json({
      success: true,
      message: 'Module created successfully',
      data: newModule[0]
    });
  } catch (error) {
    console.error('Error creating module:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating module'
    });
  }
};
// controller for updating module
export const updateModule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.user;
    const { moduleId } = req.params;
    const { name, duration, videoCount, materialCount } = req.body;

    if(!id){
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    // Check if module exists first
    const moduleExists = await db
      .select()
      .from(modulesTable)
      .where(eq(modulesTable.id, moduleId));

    if (!moduleExists.length) {
      res.status(404).json({
        success: false,
        message: 'Module not found'
      });
      return;
    }

    const isEducator = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .then((data) => data[0].isEducator);

    if (!isEducator) {
      res.status(403).json({
        success: false,
        message: 'Only authenticated educators can update modules'
      });
      return;
    }

    // Verify module exists and belongs to educator's course
    const moduleWithCourse = await db
      .select()
      .from(modulesTable)
      .innerJoin(coursesTable, eq(modulesTable.courseId, coursesTable.id))
      .innerJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
      .where(and(
        eq(modulesTable.id, moduleId),
        eq(educatorsTable.userId, id)
      ));

    if (!moduleWithCourse.length) {
      res.status(403).json({
        success: false,
        message: 'Module not found or you do not have permission to update it'
      });
      return;
    }

    // Create update object with only defined values
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (duration !== undefined) updateData.duration = duration;
    if (videoCount !== undefined) updateData.videoCount = videoCount;
    if (materialCount !== undefined) updateData.materialCount = materialCount;

    // Update module
    const updatedModule = await db.update(modulesTable)
      .set(updateData)
      .where(eq(modulesTable.id, moduleId))
      .returning();

    res.status(200).json({
      success: true,
      message: 'Module updated successfully',
      data: updatedModule[0]
    });
  } catch (error) {
    console.error('Error updating module:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating module'
    });
  }
};
//  controller for deleting module
export const deleteModule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.user;
    const { moduleId } = req.params;

    // Check if user is authenticated and an educator
    if (!id) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }
    const isEducator = await db.select().from(usersTable).where(eq(usersTable.id, id)).then((data) => data[0].isEducator);
    if (!isEducator) {
      res.status(403).json({
        success: false,
        message: 'Only authenticated educators can delete modules'
      });
      return;
    }

    // Verify module exists and belongs to educator's course
    const moduleWithCourse = await db
      .select()
      .from(modulesTable)
      .innerJoin(coursesTable, eq(modulesTable.courseId, coursesTable.id))
      .innerJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
      .where(and(
        eq(modulesTable.id, moduleId),
        eq(educatorsTable.userId, req.user.id)
      ));

    if (!moduleWithCourse.length) {
      res.status(404).json({
        success: false,
        message: 'Module not found or you do not have permission to delete it'
      });
      return;
    }

    // Delete module
    await db.delete(modulesTable)
      .where(eq(modulesTable.id, moduleId));

    res.status(200).json({
      success: true,
      message: 'Module deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting module:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting module'
    });
  }
};

// Controller for getting all modules by courseId
export const getAllModules = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;

    // First verify this is a valid course ID
    const courseExists = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId));

    if (!courseExists.length) {
      res.status(404).json({
        success: false,
        message: 'Course not found'
      });
      return;
    }

    const modules = await db
      .select()
      .from(modulesTable)
      .where(eq(modulesTable.courseId, courseId))
      .orderBy(modulesTable.name);

    res.status(200).json({
      success: true,
      data: modules
    });
  } catch (error) {
    console.error('Error fetching modules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch modules'
    });
  }
};


