'use client';
import { Course } from '@/types';
import courseService from '@/services/course.service';
import reviewService from '@/services/review.service';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { FollowerPointerCard } from '@/components/ui/following-pointer';
import PaymentModal from '@/components/PaymentModal';
import { useAuth } from '@/context/AuthContext';

export default function SingleCoursePage({ params }: { params: { courseId: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);

  useEffect(() => {
    fetchCourse();
    fetchAverageRating();
  }, [params.courseId]);

  useEffect(() => {
    if (!user) {
      setIsEnrolled(false);
      return;
    }

    checkEnrollmentStatus();
  }, [user, params.courseId]);

  const fetchCourse = async () => {
    try {
        setLoading(true);
        const response = await courseService.getSingleCourse(params.courseId);
        setCourse(response.data); // Changed from response.course to response.data based on backend response
    } catch (error) {
        console.error('Error fetching course:', error);
        setError('Failed to fetch course');
        toast.error('Failed to fetch course');
    } finally {
        setLoading(false);
    }
  };

  const fetchAverageRating = async () => {
    try {
      const response = await reviewService.getAverageRating(params.courseId);
      const normalizedRating = Number(response?.averageRating);
      setAverageRating(Number.isFinite(normalizedRating) ? normalizedRating : null);
    } catch (error) {
      console.error('Error fetching average rating:', error);
    }
  };

  const checkEnrollmentStatus = async () => {
    try {
      const response = await courseService.checkCourseAccess(params.courseId);
      setIsEnrolled(Boolean(response?.hasAccess));
    } catch {
      setIsEnrolled(false);
    }
  };

  const handlePurchaseClick = () => {
    if (!user) {
      toast.error('Please login to purchase this course');
      router.push('/login');
      return;
    }

    if (Number(course?.price) === 0) {
      handleFreeEnroll();
      return;
    }

    // Open the payment modal instead of redirecting
    setShowPaymentModal(true);
  };

  const handleFreeEnroll = async () => {
    if (!course) return;

    setProcessingPayment(true);
    try {
      const response = await courseService.purchaseCourse(course.id);
      if (!response.success) {
        throw new Error(response.message || 'Failed to enroll in free course');
      }
      setIsEnrolled(true);
      toast.success('Course added to My Courses');
      router.push(`/courses/access/${course.id}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error.message || 'Failed to enroll in free course');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handlePaymentSuccess = () => {
    setIsEnrolled(true);
    toast.success('Course purchased successfully!');
    router.push(`/courses/access/${course?.id}`);
  };

  const renderPurchaseButton = () => {
    if (isEnrolled) {
      return (
        <button
          disabled
          className="w-half bg-green-700 text-white py-2 px-4 rounded-md cursor-not-allowed"
        >
          Enrolled
        </button>
      );
    }

    if (processingPayment) {
      return (
        <button 
          disabled 
          className="w-half bg-gray-400 text-white py-2 px-4 rounded-md flex items-center justify-center"
        >
          <Loader2 className="animate-spin mr-2 h-5 w-5" />
          Processing...
        </button>
      );
    }

    return (
      <button
        onClick={handlePurchaseClick}
        className="w-half bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-md transition-colors duration-200"
      >
        {Number(course?.price) === 0 ? 'Add To My Courses' : 'Buy'}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-8 w-8 text-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-500 p-4">
          {error}
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-white">Course Details</h1>
        <div className="grid grid-cols-1 gap-8">
          {/* Left Column - Course Image and Basic Info */}
          <FollowerPointerCard>
            <div className="relative w-full h-full flex flex-col bg-gray-800 rounded-lg p-6">
              <div className="relative w-full h-64">
                <Image
                  src={course?.thumbnail || "/placeholder-course.jpg"}
                  alt={course?.name || "Course Name"}
                  fill
                  className="object-cover rounded-lg"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <div className="flex-grow mt-6">
                <h3 className="font-semibold text-2xl text-white mb-4">
                  {course?.name}
                </h3>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg text-white">
                    {Number(course?.price) === 0 ? 'Free' : `₹${course?.price}`}
                  </span>
                  {renderPurchaseButton()}
                </div>
              </div>
            </div>
          </FollowerPointerCard>

          {/* Right Column - Course Details */}
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">About This Course</h2>
              <p className="text-gray-300 mb-4">{course?.about}</p>
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-lg font-medium text-white mb-3">Description</h3>
                <p className="text-gray-300">{course?.description}</p>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Course Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-400">Instructor</h4>
                  <p className="text-white">{course?.educatorName}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-400">Start Date</h4>
                  <p className="text-white">
                    {course?.start ? new Date(course.start).toLocaleDateString() : 'Not specified'}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-400">Views</h4>
                  <p className="text-white">{course?.viewcount || 0}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-400">Rating</h4>
                  <p className="text-white">
                    {typeof averageRating === 'number' ? averageRating.toFixed(1) : 'Not rated'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showPaymentModal && course && (
        <PaymentModal
          course={{
            id: course.id,
            title: course.name,
            price: course.price
          }}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
