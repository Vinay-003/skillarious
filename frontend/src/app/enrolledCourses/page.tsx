'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Progress from '@/components/ui/Progress';
import StudentService from '@/services/student.service';
import toast from 'react-hot-toast';
import { EnrolledCourse } from '@/types/api';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    fetchEnrolledCourses();
  }, [user]);

  const fetchEnrolledCourses = async () => {
    try {
      setLoading(true);
      const response = await StudentService.getEnrolledCourses();
      if (response.success) {
        setCourses(response.data);
      } else {
        toast.error('Failed to fetch enrolled courses');
      }
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
      toast.error('Failed to fetch enrolled courses');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-8">
        <h1 className="text-2xl font-bold text-white mb-4">My Courses</h1>
        <p className="text-gray-400">You haven't enrolled in any courses yet.</p>
        <Link 
          href="/courses" 
          className="text-blue-500 hover:text-blue-400 mt-2 inline-block"
        >
          Browse Courses
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">My Courses</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div 
            key={course.id} 
            className="bg-gray-800 rounded-lg overflow-hidden shadow-lg"
          >
            <div className="relative h-48">
              <Image
                src={course.thumbnail || '/default-course-thumbnail.jpg'}
                alt={course.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Image
                  src={course.educatorPfp || '/default-avatar.jpg'}
                  alt={course.educatorName}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
                <span className="text-gray-300">{course.educatorName}</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{course.name}</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Progress</span>
                  <span className="text-gray-300">{Math.round(course.completionRate)}%</span>
                </div>
                <Progress value={course.completionRate} className="h-2" />
              </div>
              <Link 
                href={`/courses/access/${course.id}`}
                className="block text-center bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md mt-4"
              >
                Continue Learning
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}