import { Request, Response } from 'express';
import { db } from '../db/index.ts';
import { educatorsTable, usersTable } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

// Register as educator
export const registerAsEducator = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const { bio, about } = req.body;

    // Check if user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already an educator
    const existingEducator = await db.select()
      .from(educatorsTable)
      .where(eq(educatorsTable.userId, userId));

    if (existingEducator.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User is already registered as an educator'
      });
    }

    // Create educator profile
    const newEducator = await db.insert(educatorsTable)
      .values({
        userId,
        bio: bio || null,
        about: about || null,
        doubtOpen: false
      })
      .returning();

    // Update user isEducator status
    await db.update(usersTable)
      .set({ isEducator: true })
      .where(eq(usersTable.id, userId));

    return res.status(201).json({
      success: true,
      message: 'Successfully registered as educator',
      data: newEducator[0]
    });
  } catch (error) {
    console.error('Error in registerAsEducator:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register as educator'
    });
  }
};

// Get educator profile
export const getEducatorProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;

    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    console.log(user)
    if (!user[0].isEducator) {
      return res.status(403).json({
        success: false,
        message: 'User is not registered as an educator'
      });
    }
    
    const educator = await db.select()
      .from(educatorsTable)
      .where(eq(educatorsTable.userId, userId));

    // Backfill missing educator row for users already flagged as educators.
    // This prevents 404s in old/inconsistent data states.
    if (!educator.length) {
      const [createdEducator] = await db.insert(educatorsTable)
        .values({
          userId,
          bio: null,
          about: null,
          doubtOpen: false
        })
        .returning();

      return res.status(200).json({
        success: true,
        data: createdEducator
      });
    }

    return res.status(200).json({
      success: true,
      data: educator[0]
    });
  } catch (error) {
    console.error('Error in getEducatorProfile:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching educator profile'
    });
  }
};

// Update educator profile
export const updateEducatorProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const { bio, about, doubtOpen } = req.body;

    const updatedEducator = await db.update(educatorsTable)
      .set({
        bio: bio || undefined,
        about: about || undefined,
        doubtOpen: doubtOpen !== undefined ? doubtOpen : undefined
      })
      .where(eq(educatorsTable.userId, userId))
      .returning();

    if (!updatedEducator.length) {
      return res.status(404).json({
        success: false,
        message: 'Educator profile not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedEducator[0]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error updating educator profile'
    });
  }
};

// Toggle doubt availability
export const toggleDoubtAvailability = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user.id;

    const educator = await db.select()
      .from(educatorsTable)
      .where(eq(educatorsTable.userId, userId));

    if (!educator.length) {
      return res.status(404).json({
        success: false,
        message: 'Educator not found'
      });
    }

    const updatedEducator = await db.update(educatorsTable)
      .set({
        doubtOpen: !educator[0].doubtOpen
      })
      .where(eq(educatorsTable.userId, userId))
      .returning();

    return res.status(200).json({
      success: true,
      message: `Doubt availability ${updatedEducator[0].doubtOpen ? 'enabled' : 'disabled'}`,
      data: updatedEducator[0]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error toggling doubt availability'
    });
  }
};
