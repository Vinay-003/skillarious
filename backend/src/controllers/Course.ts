import {Request,Response} from 'express';
import {db} from '../db/index.ts';
import{coursesTable, educatorsTable, categoryTable, transactionsTable, usersTable, categoryCoursesTable} from '../db/schema.ts';
import { eq,or,sql, and } from 'drizzle-orm';

interface AuthenticatedRequest extends Request {
    user: {
        id: string;
        email: string;
    };
}

// Helper function to verify course ownership
const verifyEducatorOwnership = async (userId: string, educatorId: string): Promise<boolean> => {
  const educator = await db
    .select()
    .from(educatorsTable)
    .where(and(
      eq(educatorsTable.userId, userId),
      eq(educatorsTable.id, educatorId)
    ))
    .limit(1);

  return educator.length > 0;
};

// 1) Controller to create a course
export const createCourse = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const { name, description, about, price } = req.body;
    const { id: userId } = req.user;
    const { educatorId } = req.params; // Get from route params

    // Verify ownership
    const isOwner = await verifyEducatorOwnership(userId, educatorId);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You can only create courses for your own educator profile'
      });
    }

    if (name == null || description == null || about == null || price == null || price === '') {
        return res.status(400).json({
            success: false,
            message: 'Required fields are missing'
        });
    }

    const parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be a valid non-negative number'
      });
    }
    const isEducator = await db.select().from(usersTable).where(eq(usersTable.id, userId)).then((data) => data[0].isEducator);
    if(!isEducator){
        return res.status(403).json({
            success: false,
            message: 'Only educators can create courses'
        });
    }
    // insert into database
    const newCourse = await db.insert(coursesTable).values({
        name,
        description,
        about,
        educatorId,
        price: parsedPrice.toString(), // Store as string
        comments: "",
        start: new Date(),
        end: new Date(),
        thumbnail: "",
    }).returning();
    ;
    //ensure newcourse is valid
    if(!newCourse || !newCourse[0].id){
        return res.status(500).json({
            success: false,
            message: "Failed to create course",
        });
    }return res.status(201).json({
        success: true,
        message: "Course created successfully",
        courseId: newCourse[0].id,
    });
  } catch (error) {
    console.error('Error creating course:', error);
    return res.status(500).json({ 
        success: false,
        message: 'Error in creating course' });
  }
};

// 2) controller for updating the course

export const updateCourse = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const { CourseId } = req.params;
    const { id: userId } = req.user;

    // First get the course to check ownership
    const course = await db
      .select()
      .from(coursesTable)
      .innerJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
      .where(eq(coursesTable.id, CourseId))
      .limit(1);

    if (!course.length) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Verify ownership
    const isOwner = await verifyEducatorOwnership(userId, course[0].courses.educatorId);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own courses'
      });
    }

    const {name, description, about, price} = req.body;
    const isEducator = await db.select().from(usersTable).where(eq(usersTable.id, userId)).then((data) => data[0].isEducator);
    if (!isEducator) {
        return res.status(403).json({ message: 'Only educators can update courses' });
    }

    // Create an update object with only defined values
    const updateData: Record<string, any> = {};
    
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (about) updateData.about = about;
    if (price !== undefined && price !== null && price !== '') {
      const parsedPrice = Number(price);
      if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({
          success: false,
          message: 'Price must be a valid non-negative number'
        });
      }
      updateData.price = parsedPrice.toString();
    }

    // Only perform update if there are fields to update
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Update the course with only defined fields
    const updatedCourse = await db.update(coursesTable)
      .set(updateData)
      .where(eq(coursesTable.id, CourseId))
      .returning();

    return res.status(200).json({
      success: true,
      message: 'Course updated successfully',
      course: updatedCourse[0],
    });
  } catch (error) {
    console.error('Error updating course:', error);
    return res.status(500).json({
      success: false,
      message: 'Error in updating course'
    });
  }
};
  // 3)  controller for deleting the course
 export const deleteCourse = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const { id: userId } = req.user;
    const { CourseId } = req.params; // Course ID from URL

    // First get the course to check ownership
    const course = await db
      .select()
      .from(coursesTable)
      .innerJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
      .where(eq(coursesTable.id, CourseId))
      .limit(1);

    if (!course.length) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Verify ownership
    const isOwner = await verifyEducatorOwnership(userId, course[0].courses.educatorId);
    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own courses'
      });
    }

    // Delete course
    await db.delete(coursesTable).where(eq(coursesTable.id, CourseId));

    return res.status(200).json({ 
      success: true,
      message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Error deleting course:', error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting course'
    });
  }
};

// 4) controller for GetAll courses

export const getAllCourses = async (req: Request, res: Response): Promise<Response> => {
    try {
      const courses = await db
        .select({
          id: coursesTable.id,
          name: coursesTable.name,
          description: coursesTable.description,
          about: coursesTable.about,
          price: coursesTable.price,
          thumbnail: coursesTable.thumbnail,
          viewCount: coursesTable.viewCount,
          start: coursesTable.start,
          educatorId: coursesTable.educatorId,
          educatorName: usersTable.name,  
          educatorPfp: usersTable.pfp,      
        })
        .from(coursesTable)
        .innerJoin(
          educatorsTable, 
          eq(coursesTable.educatorId, educatorsTable.id)
        )
        .innerJoin(
          usersTable, 
          eq(educatorsTable.userId, usersTable.id)
        );
  
      return res.status(200).json({
        success: true,
        message: 'Courses fetched successfully',
        courses,
      });
    } catch (error) {
      console.error('Error fetching courses:', error);
      return res.status(500).json({
        success: false,
        message: 'Error fetching courses'
      });
    }
};

  // controller for getting a single course
  export const getSingleCourse = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params;
  
      // Fetch course details
      const course = await db
        .select({
          id: coursesTable.id,
          name: coursesTable.name,
          description: coursesTable.description,
          about: coursesTable.about,
          rating: coursesTable.thumbnail,
          price: coursesTable.price,
          educatorId: coursesTable.educatorId,
          educatorName: usersTable.name,
        })
        .from(coursesTable)
        .leftJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
        .leftJoin(usersTable, eq(educatorsTable.userId, usersTable.id))
        .where(eq(coursesTable.id, id));
  
      if (!course.length) {
        return res.status(404).json({ message: 'Course not found' });
      }
  
      return res.status(200).json({
        success: true,
        message: 'Course fetched successfully',
        data: course[0]  // Changed to match expected structure
      });
  
    } catch (error) {
      console.error('Error fetching course:', error);
      return res.status(500).json({ message: 'Error fetching course' });
    }
  };

  // 5) controller for search course

  export const searchCourses = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { name,description,about } = req.query;
  
      if (!name &&!description && !about) {
        return res.status(400).json({ message: 'Search query is required' });
      }
  
      // Using SQL raw query for searching (ILIKE for case-insensitive search)
      const courses = await db
        .select({
          id: coursesTable.id,
          name: coursesTable.name,
          description: coursesTable.description,
          about: coursesTable.about,
          price: coursesTable.price,
          educatorId: coursesTable.educatorId,
           })
        .from(coursesTable)
        .leftJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
        .where(
          or(
            sql`${coursesTable.name} ILIKE ${ name + '%'}`,
            sql`${coursesTable.description} ILIKE ${description + '%'}`,
            sql`${coursesTable.about} ILIKE ${ about + '%'}`
          )
        );
      
      return res.status(200).json({
        message: 'Courses searched successfully',
        courses,
      });
  
    } catch (error) {
      console.error('Error searching courses:', error);
      return res.status(500).json({ message: 'Error searching courses' });
    }
  };
//   controller for add categories

export const addCategory = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const {id} = req.user;
    const {categoryId, courseId} = req.body;
    
    if(!categoryId || !courseId){
      return res.status(400).json({
        success: false,
        message: 'Required fields are missing'
      });
    }

    // Check if user is an educator
    const isEducator = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .then((data) => data[0].isEducator);

    if(!isEducator){
      return res.status(403).json({
        success: false,
        message: 'Only educators can add categories to courses'
      });
    }

    // Verify the course belongs to this educator
    const courseOwnership = await db
      .select()
      .from(coursesTable)
      .innerJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
      .where(and(
        eq(coursesTable.id, courseId),
        eq(educatorsTable.userId, id)
      ));

    if (!courseOwnership.length) {
      return res.status(403).json({
        success: false,
        message: 'You can only add categories to your own courses'
      });
    }

    // Verify category exists
    const categoryExists = await db
      .select()
      .from(categoryTable)
      .where(eq(categoryTable.id, categoryId));

    if (!categoryExists.length) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Add category to course
    const category = await db.insert(categoryCoursesTable).values({
      categoryId,
      courseId
    }).returning();

    return res.status(201).json({
      success: true,
      message: 'Category added to course successfully',
      data: category[0]
    });
  } catch (error) {
    if (error) { // Unique constraint violation
      return res.status(400).json({
        success: false,
        message: 'This course is already associated with this category'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Error adding category to course'
    });
  }
}; // 6) controller for get courses by category

 export const getCoursesByCategory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { query} = req.query;
    const courses = await db
      .select({
        id: coursesTable.id,
        name: coursesTable.name,
        description: coursesTable.description,
        about: coursesTable.about,
        price: coursesTable.price,
        thumbnail: coursesTable.thumbnail,
        educatorId: coursesTable.educatorId
      })
      .from(coursesTable)
      .innerJoin(
        categoryCoursesTable,
        eq(categoryCoursesTable.courseId, coursesTable.id)
      )
      .innerJoin(
        categoryTable,
        eq(categoryTable.id, categoryCoursesTable.categoryId)
      )
      .where(sql`${categoryTable.name} ILIKE ${query + '%'}`);

    return res.status(200).json({
      message: 'Courses fetched successfully',
      courses,
    });

  } catch (error) {
    console.error('Error fetching courses by category:', error);
    return res.status(500).json({ message: 'Error fetching courses' });
  }};
// 7)  controller for specific educator

export const getCoursesByEducator = async (req: Request, res: Response): Promise<Response> => {
  try {
    const {id} =req.params as {id: string} ;
    
    if (!id) {
      return res.status(400).json({ message: 'Educator ID is required' });
    }

    const courses = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.educatorId, id));

    return res.status(200).json({
      message: 'Courses fetched successfully',
      courses,
    });

  } catch (error) {
    console.error('Error in fetching courses by educator:', error);
    return res.status(500).json({ message: 'Error fetching courses' });
  }
};

// Example function to check enrollment
const isUserEnrolled = async (userId: string, courseId: string) => {
    const transaction = await db
        .select()
        .from(transactionsTable)
        .where(
            and(
                eq(transactionsTable.userId, userId),
                eq(transactionsTable.courseId, courseId),
                eq(transactionsTable.status, 'completed')
            )
        )
        .limit(1);
    
    return transaction.length > 0;
};

export const checkCourseOwnership = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const { id: userId } = req.user;
    const { courseId } = req.params;

    const course = await db
      .select()
      .from(coursesTable)
      .innerJoin(educatorsTable, eq(coursesTable.educatorId, educatorsTable.id))
      .where(and(
        eq(coursesTable.id, courseId),
        eq(educatorsTable.userId, userId)
      ))
      .limit(1);

    return res.status(200).json({
      success: course.length > 0,
      isOwner: course.length > 0
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking course ownership'
    });
  }
};

export const checkCourseAccess = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const { id: userId } = req.user;
    const { courseId } = req.params;

    // Check if user has purchased the course
    const transaction = await db
      .select()
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.courseId, courseId),
        eq(transactionsTable.status, 'completed')
      ))
      .limit(1);

    return res.status(200).json({
      success: transaction.length > 0,
      hasAccess: transaction.length > 0
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking course access'
    });
  }
};

export const purchaseCourse = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  try {
    const { id: userId } = req.user;
    const { courseId } = req.params;

    const [course] = await db
      .select({
        id: coursesTable.id,
        price: coursesTable.price
      })
      .from(coursesTable)
      .where(eq(coursesTable.id, courseId))
      .limit(1);

    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    if (Number(course.price) !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Only free courses can be enrolled directly'
      });
    }

    const alreadyEnrolled = await isUserEnrolled(userId, courseId);
    if (alreadyEnrolled) {
      return res.status(200).json({
        success: true,
        message: 'Course already in your My Courses list'
      });
    }

    // Create transaction record
    await db.insert(transactionsTable).values({
      date: new Date(),
      userId,
      courseId,
      status: 'completed',
      amount: '0',
      paymentId: 'FREE_COURSE'
    });

    return res.status(200).json({
      success: true,
      message: 'Course purchased successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error purchasing course'
    });
  }
};

export const getPurchasedCourses = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: userId } = req.user;

    const purchases = await db
      .select({
        courseId: transactionsTable.courseId,
        purchaseDate: transactionsTable.createdAt
      })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.userId, userId),
        eq(transactionsTable.status, 'completed')
      ));

    return res.status(200).json({
      success: true,
      purchases
    });
  } catch (error) {
    console.error('Error fetching purchased courses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch purchased courses'
    });
  }
};
