import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index.ts';
import { usersTable } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

export const isAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user?.isAdmin || user.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking admin status'
    });
  }
};


// A separate bootstrap mechanism must provision the first administrator. Invites
// require the explicit superadmin role rather than trusting client-supplied flags.
export const isSuperAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const [user] = await db.select({ role: usersTable.role, isBanned: usersTable.isBanned }).from(usersTable).where(eq(usersTable.id, req.user.id)).limit(1);
    if (user?.role !== 'superadmin' || user.isBanned) return res.status(403).json({ success: false, message: 'Superadmin access required' });
    next();
  } catch (error) { return res.status(500).json({ success: false, message: 'Could not check admin access' }); }
};
