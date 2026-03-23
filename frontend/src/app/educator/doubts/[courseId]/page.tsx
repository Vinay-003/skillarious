'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import courseService from '@/services/course.service';
import CourseModuleDoubts from '@/components/CourseModuleDoubts';

export default function EducatorCourseDoubtsPage({ params }: { params: { courseId: string } }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [courseName, setCourseName] = useState('Course');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!user.isEducator) {
      router.push('/');
      return;
    }

    fetchCourseMeta();
  }, [authLoading, user, params.courseId]);

  const fetchCourseMeta = async () => {
    try {
      setLoading(true);
      const courseResponse = await courseService.getSingleCourse(params.courseId);

      if (courseResponse?.data?.name) {
        setCourseName(courseResponse.data.name);
      }
    } catch (error) {
      console.error('Error fetching module doubts:', error);
      toast.error('Failed to load module doubts');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/educator"
          className="inline-flex items-center gap-2 text-gray-300 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Courses Taught
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Module Doubts</h1>
        <p className="text-gray-400 mb-8">{courseName}</p>
        <CourseModuleDoubts
          courseId={params.courseId}
          canReply
          emptyTitle="No doubts found in this course modules yet."
        />
      </div>
    </div>
  );
}
