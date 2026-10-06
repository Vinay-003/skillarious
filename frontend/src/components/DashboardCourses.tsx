import Link from 'next/link';
import type { Course } from '@/types';
import { useAuth } from '@/context/AuthContext';

export default function DashboardCourses({ courses }: { courses: Course[] }) {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {user?.isEducator ? 'My Courses' : 'Enrolled Courses'}
        </h2>
        {user?.isEducator && (
          <Link 
            href="/courses/create" 
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            Create New Course
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div key={course.id} className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-xl font-bold">{course.name}</h3>
            <div className="mt-4">
              <Link 
                href={`/courses/access/${course.id}`}
                className="text-blue-400 hover:text-blue-300"
              >
                {user?.isEducator ? 'Manage Course' : 'Continue Learning'}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}