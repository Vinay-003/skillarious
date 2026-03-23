import { Request, Response } from 'express';
import { db } from '../db/index.ts';
import { categoryTable, usersTable } from '../db/schema.ts';
import { sql, eq } from 'drizzle-orm';

const isDbUnavailableError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; message?: string };
  return (
    err.code === 'ENETUNREACH' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ETIMEDOUT' ||
    err.code === '57P01' ||
    (typeof err.message === 'string' && err.message.toLowerCase().includes('connect enetunreach'))
  );
};

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}
export const createCategory = async (req: AuthenticatedRequest, res: Response) => {
  try { 
    const { id } = req.user;
    if(!id){
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    // Check if user is authenticated and an admin
    const user = await db.select().from(usersTable).where(eq(usersTable.id, id)).then((data) => data[0]);
    if (!user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can manage categories'
      });
    }
    const { name, description } = req.body;

    const category = await db.insert(categoryTable).values({
      name,
      description
    }).returning();

    return res.status(201).json({
      success: true,
      data: category[0]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error creating category'
    });
  }
};
// controller for update category
export const updateCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.user;
    if(!id){
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const { categoryId } = req.params;
    const { name, description } = req.body;
    
    const user = await db.select().from(usersTable).where(eq(usersTable.id, id)).then((data) => data[0]);
    if (!user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can manage categories'
      });
    }

    const updatedCategory = await db
      .update(categoryTable)
      .set({
        name,
        description
      })
      .where(eq(categoryTable.id, categoryId))
      .returning();

    return res.status(200).json({
      success: true,
      data: updatedCategory[0]
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error updating category'
    });
  }
};
// controller for delete category

export const deleteCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.user;
    if(!id){
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const { categoryId } = req.params;
    
    const user = await db.select().from(usersTable).where(eq(usersTable.id, id)).then((data) => data[0]);
    if (!user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can manage categories'
      });
    }

    await db.delete(categoryTable).where(eq(categoryTable.id, categoryId));
    return res.status(200).json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error deleting category'
    });
  }
};

//controlller for getAlll categories
export const getAllCategories = async (req: Request, res: Response) => {
  try {
    
    const categories = await db.select().from(categoryTable);
    return res.status(200).json({
      success: true,
      message: 'Categories fetched successfully',
      data: categories
    });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return res.status(503).json({
        success: false,
        message: 'Database unavailable. Check backend DATABASE_URL or use a Supabase pooler IPv4 URL.',
        data: []
      });
    }

    console.error('getAllCategories error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching categories'
    });
  }
};  

// controller for searching categories
export const getCategoryBySearch = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    console.log('Search query:', query);

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Invalid search query' 
      });
    }

    const categories = await db
      .select({
        id: categoryTable.id, 
        name: categoryTable.name,
        description: categoryTable.description
      })
      .from(categoryTable)
      .where(sql`${categoryTable.name} ILIKE ${query + '%'}`);


    return res.status(200).json({
      success: true,
      message: 'Categories searched successfully',
      data: categories
    });
  } catch (error) {
    console.error('Search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error searching categories'
    });
  }
};

