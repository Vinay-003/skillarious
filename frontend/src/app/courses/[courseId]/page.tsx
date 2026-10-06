'use client';
import { useRequiredParams } from '@/hooks/useRequiredParams';
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
import LearningAssistant from '@/components/LearningAssistant';
import libraryService, { libraryError, Playlist } from '@/services/library.service';
import Link from 'next/link';

export default function SingleCoursePage() {
  const params = useRequiredParams<{ courseId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [liked, setLiked] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryErrorText, setLibraryErrorText] = useState('');
  const [libraryRetry, setLibraryRetry] = useState(0);

  useEffect(() => {
    if (authLoading || !user || !course) return;
    let active = true;
    setLibraryLoading(true);
    setLibraryErrorText('');
    Promise.all([libraryService.likes(), libraryService.subscriptions(), libraryService.playlists()])
      .then(([likes, subscriptions, saved]) => {
        if (!active) return;
        setLiked(likes.some(item => item.id === course.id));
        setFollowed(subscriptions.some(item => item.id === course.educatorId));
        setPlaylists(saved);
      })
      .catch(error => { if (active) setLibraryErrorText(libraryError(error)); })
      .finally(() => { if (active) setLibraryLoading(false); });
    return () => { active = false; };
  }, [authLoading, user, course, libraryRetry]);

  async function updateLibrary(action: () => Promise<unknown>, refresh: () => Promise<void>) {
    setLibraryBusy(true); setLibraryErrorText('');
    try { await action(); await refresh(); }
    catch (error) { setLibraryErrorText(libraryError(error)); }
    finally { setLibraryBusy(false); }
  }

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
        setCourse(response.data || response.course);
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
          className="studio-button"
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
        className="studio-button"
      >
        {Number(course?.price) === 0 ? 'Add to my courses' : 'Continue to PayPal'}
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
    <div className="shell page-section">
      <div className="max-w-7xl mx-auto">
        <p className="eyebrow mb-4">The collection / Course details</p><h1 className="editorial-title mb-10">{course?.name}</h1>
        <div className="grid grid-cols-1 gap-8">
          {/* Left Column - Course Image and Basic Info */}
          <FollowerPointerCard>
            <div className="relative w-full h-full flex flex-col studio-card p-6">
              <div className="relative w-full h-64">
                <Image
                  src={course?.thumbnail || "/course/placeholder.png"}
                  alt={course?.name || "Course Name"}
                  fill
                  className="object-cover rounded-lg"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              <div className="flex-grow mt-6">
                <h3 className="font-semibold text-2xl mb-4">
                  {course?.name}
                </h3>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg">
                    {Number(course?.price) === 0 ? 'Free' : `$${Number(course?.price).toFixed(2)} USD`}
                  </span>
                  {renderPurchaseButton()}
                </div>
              </div>
            </div>
          </FollowerPointerCard>

          {/* Right Column - Course Details */}
          <div className="space-y-6">
            <div className="studio-card p-6">
              <h2 className="text-2xl mb-4">About this course</h2>
              <p className="text-[var(--muted-ink)] mb-4">{course?.about}</p>
              <div className="border-t border-[var(--line)] pt-4">
                <h3 className="text-lg mb-3">What you&apos;ll explore</h3>
                <p className="text-[var(--muted-ink)]">{course?.description}</p>
              </div>
            </div>

            {user && course && <div className="studio-card p-6 space-y-4">
              <h2 className="text-2xl">Your library</h2>
              {libraryErrorText && <p role="alert" className="text-red-600">{libraryErrorText} <button className="underline" onClick={() => setLibraryRetry(value => value + 1)}>Retry</button></p>}
              {libraryLoading ? <p>Loading your library…</p> : <>
                <div className="flex flex-wrap gap-4">
                  <button className="studio-button" disabled={libraryBusy || Boolean(libraryErrorText)} onClick={() => void updateLibrary(
                    () => liked ? libraryService.unlike(course.id) : libraryService.like(course.id),
                    async () => setLiked((await libraryService.likes()).some(item => item.id === course.id))
                  )}>{liked ? 'Unlike course' : 'Like course'}</button>
                  <button className="studio-button" disabled={libraryBusy || Boolean(libraryErrorText)} onClick={() => void updateLibrary(
                    () => followed ? libraryService.unfollow(course.educatorId) : libraryService.follow(course.educatorId),
                    async () => setFollowed((await libraryService.subscriptions()).some(item => item.id === course.educatorId))
                  )}>{followed ? 'Unfollow educator' : 'Follow educator'}</button>
                </div>
                <div><label htmlFor="save-playlist" className="block mb-2">Save to a playlist</label>
                  <select id="save-playlist" className="studio-card p-2 max-w-full" disabled={libraryBusy || Boolean(libraryErrorText)} value="" onChange={event => {
                    const playlistId = event.target.value;
                    if (!playlistId) return;
                    void updateLibrary(() => libraryService.addCourse(playlistId, course.id), async () => setPlaylists(await libraryService.playlists()));
                  }}><option value="">Choose a playlist</option>{playlists.filter(playlist => !playlist.courses.some(item => item.id === course.id)).map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select>
                  <p className="mt-2 text-sm">{playlists.filter(playlist => playlist.courses.some(item => item.id === course.id)).map(playlist => playlist.name).join(', ') || 'Not in a playlist yet.'} <Link className="underline" href="/playlists">Manage playlists</Link></p>
                </div>
              </>}
            </div>}

            <div className="studio-card p-6">
              <h2 className="text-2xl mb-4">At a glance</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-[var(--muted-ink)]">Instructor</h4>
                  <p>{course?.educatorName}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[var(--muted-ink)]">Start date</h4>
                  <p>
                    {course?.start ? new Date(course.start).toLocaleDateString() : 'Not specified'}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[var(--muted-ink)]">Views</h4>
                  <p>{course?.viewcount || 0}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-[var(--muted-ink)]">Rating</h4>
                  <p>
                    {typeof averageRating === 'number' ? averageRating.toFixed(1) : 'Not rated'}
                  </p>
                </div>
              </div>
            </div>
            {course && <LearningAssistant courseId={course.id} title={`Ask about ${course.name}`} />}
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
