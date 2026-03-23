import { Request, Response } from 'express';
import { db } from '../db/index.ts';
import { reviewsTable, coursesTable, transactionsTable } from '../db/schema.ts';
import { eq, avg, desc, and, sql } from 'drizzle-orm';

interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
    };
}

// Add this helper function
const verifyPurchase = async (userId: string, courseId: string) => {
    try {
        // First get the transaction and log its exact status
        const transactions = await db
            .select({
                id: transactionsTable.id,
                userId: transactionsTable.userId,
                courseId: transactionsTable.courseId,
                status: transactionsTable.status
            })
            .from(transactionsTable)
            .where(
                and(
                    eq(transactionsTable.userId, userId),
                    eq(transactionsTable.courseId, courseId)
                )
            );

       
        if (transactions.length > 0) {
            console.log('Status exact value:', {
                status: transactions[0].status,
                statusLength: transactions[0].status.length,
                statusCharCodes: [...transactions[0].status].map(char => char.charCodeAt(0))
            });
        }

        // Try with LIKE operator
        const completedTransactions = await db
            .select()
            .from(transactionsTable)
            .where(
                and(
                    eq(transactionsTable.userId, userId),
                    eq(transactionsTable.courseId, courseId),
                    sql`${transactionsTable.status} LIKE 'completed%'` // Match 'completed' followed by anything
                )
            );

        

        return completedTransactions.length > 0;
    } catch (error) {
        console.error('Error verifying purchase:', error);
        return false;
    }
};

// Create a new review
export const createReview = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { rating, message, courseId } = req.body;

        if (!userId || !rating || !courseId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields',
                details: { userId, rating, courseId }
            });
        }

        // check if a review already exists
        const existingReview = await db
            .select()
            .from(reviewsTable)
            .where(
                and(
                    eq(reviewsTable.userId, userId),
                    eq(reviewsTable.courseId, courseId)
                )
            );

        

        if (existingReview.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'You have already reviewed this course',
                existingReview: existingReview[0]
            });
        }

        const hasPurchased = await verifyPurchase(userId, courseId);
        
        if (!hasPurchased) {
            return res.status(403).json({
                success: false,
                message: 'You must purchase the course before reviewing',
                details: {
                    userId,
                    courseId,
                    verified: false
                }
            });
        }

        // Create new review
        const review = await db
            .insert(reviewsTable)
            .values({
                userId,
                courseId,
                rating,
                message,
                createdAt: new Date()
            })
            .returning();

        return res.status(201).json({
            success: true,
            message: 'Review created successfully',
            review: review[0]
        });
    } catch (error) {
        console.error('Review creation error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error creating review'
        });
    }
};

// Update an existing review
export const updateReview = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.params;
        const { rating, message } = req.body;

        // First check if review exists and belongs to the user
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized - User ID is required'
            });
        }

        const existingReview = await db
            .select()
            .from(reviewsTable)
            .where(
                and(
                    eq(reviewsTable.userId, userId as string),
                    eq(reviewsTable.courseId, courseId)
                )
            );

        if (!existingReview.length) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to update this review'
            });
        }

        // Update the review
        const updatedReview = await db
            .update(reviewsTable)
            .set({
                rating,
                message, 
            })
            .where(
                and(
                    eq(reviewsTable.userId, userId),
                    eq(reviewsTable.courseId, courseId)
                )
            )
            .returning();

        return res.status(200).json({
            success: true,
            message: 'Review updated successfully',
            review: updatedReview[0]
        });
    } catch (error) {
        console.error('Review update error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating review'
        });
    }
};

// Get average rating for a course
export const getAverageRating = async (req: Request, res: Response) => {
    try {
        const { courseId } = req.params;

        const result = await db
            .select({
                averageRating: avg(reviewsTable.rating)
            })
            .from(reviewsTable)
            .where(eq(reviewsTable.courseId, courseId));

        const rawAverage = result[0]?.averageRating;
        const averageRating =
            rawAverage === null || rawAverage === undefined
                ? 0
                : Number(rawAverage);

        return res.status(200).json({
            success: true,
            averageRating: Number.isFinite(averageRating) ? averageRating : 0
        });
    } catch (error) {
        console.error('Error fetching average rating:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching average rating'
        });
    }
};

// Get all reviews for a course
export const getCourseReviews = async (req: Request, res: Response) => {
    try {
        const { courseId } = req.params;

        const reviews = await db
            .select()
            .from(reviewsTable)
            .where(eq(reviewsTable.courseId, courseId))
            .orderBy(desc(reviewsTable.rating));

        return res.status(200).json({
            success: true,
            reviews
        });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching reviews'
        });
    }
};

// Delete a review
export const deleteReview = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.params;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized - User ID is required'
            });
        }

        // Check if review exists and belongs to the user
        const existingReview = await db
            .select()
            .from(reviewsTable)
            .where(
                and(
                    eq(reviewsTable.userId, userId),
                    eq(reviewsTable.courseId, courseId)
                )
            );

        if (!existingReview.length) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to delete this review'
            });
        }

        // Delete the review
        await db
            .delete(reviewsTable)
            .where(
                and(
                    eq(reviewsTable.userId, userId),
                    eq(reviewsTable.courseId, courseId)
                )
            );

        return res.status(200).json({
            success: true,
            message: 'Review deleted successfully'
        });
    } catch (error) {
        console.error('Review deletion error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error deleting review'
        });
    }
};








