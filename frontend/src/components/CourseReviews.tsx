'use client';

import React, { useState, useEffect } from 'react';
import { Star, Edit2, Trash2 } from 'lucide-react';
import { Review } from '@/types';
import reviewService from '@/services/review.service';
import { toast } from 'react-hot-toast';

interface ReviewFormData {
    rating: number;
    message: string;
}

export default function CourseReviews({ courseId }: { courseId: string }) {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [userReview, setUserReview] = useState<Review | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<ReviewFormData>({
        rating: 5,
        message: ''
    });

    useEffect(() => {
        loadReviews();
    }, [courseId]);

    const loadReviews = async () => {
        try {
            const response = await reviewService.getCourseReviews(courseId);
            setReviews(response.reviews);
            const userReview = response.reviews.find(review => review.isOwner);
            if (userReview) {
                setUserReview(userReview);
            }
        } catch (error) {
            toast.error('Failed to load reviews');
        }
    };

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEditing && userReview) {
                const response = await reviewService.updateReview(
                    courseId,
                    formData.rating,
                    formData.message
                );
                setUserReview(response.review);
                toast.success('Review updated successfully');
            } else {
                const response = await reviewService.createReview(
                    courseId,
                    formData.rating,
                    formData.message
                );
                setUserReview(response.review);
                toast.success('Review submitted successfully');
            }
            setIsEditing(false);
            loadReviews();
        } catch (error: any) {
            if (error.response?.data?.message?.includes('must purchase')) {
                toast.error('Please purchase this course to leave a review');
            } else {
                toast.error('Failed to submit review');
            }
        }
    };

    const handleDeleteReview = async () => {
        if (!userReview) return;
        try {
            await reviewService.deleteReview(courseId);
            setUserReview(null);
            toast.success('Review deleted successfully');
            loadReviews();
        } catch (error) {
            toast.error('Failed to delete review');
        }
    };

    return (
        <div className="space-y-6">
            {/* Review Form */}
            {(!userReview || isEditing) && (
                <form onSubmit={handleSubmitReview} className="space-y-4">
                    <div>
                        <label className="block mb-2 text-white">Rating</label>
                        <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, rating: star })}
                                    className={`text-2xl ${
                                        star <= formData.rating ? 'text-yellow-400' : 'text-gray-300'
                                    }`}
                                >
                                    ★
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block mb-2 text-white">Review</label>
                        <textarea
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            className="w-full p-2 border rounded bg-gray-800 text-white"
                            rows={4}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        {isEditing ? 'Update Review' : 'Submit Review'}
                    </button>
                </form>
            )}

            {/* User's Review */}
            {userReview && !isEditing && (
                <div className="border p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, index) => (
                                    <Star
                                        key={index}
                                        className={`w-5 h-5 ${
                                            index < userReview.rating
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'text-gray-300'
                                        }`}
                                    />
                                ))}
                            </div>
                            <p className="mt-2 text-gray-200">{userReview.message}</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setFormData({
                                        rating: userReview.rating,
                                        message: userReview.message
                                    });
                                    setIsEditing(true);
                                }}
                                className="text-blue-500 hover:text-blue-600"
                            >
                                <Edit2 className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleDeleteReview}
                                className="text-red-500 hover:text-red-600"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Other Reviews */}
            <div className="space-y-4">
                <h3 className="text-xl font-semibold text-white">All Reviews</h3>
                {reviews
                    .filter(review => !review.isOwner)
                    .map((review) => (
                        <div key={review.id} className="border p-4 rounded-lg">
                            <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, index) => (
                                    <Star
                                        key={index}
                                        className={`w-5 h-5 ${
                                            index < review.rating
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'text-gray-300'
                                        }`}
                                    />
                                ))}
                            </div>
                            <p className="mt-2 text-gray-200">{review.message}</p>
                        </div>
                    ))}
            </div>
        </div>
    );
}
