'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import courseService from '@/services/course.service';
import categoryService from '@/services/category.service';
import { Course, Category } from '@/types';
import { FollowerPointerCard } from '@/components/ui/following-pointer';
import Image from 'next/image';
import { CourseCardSkeleton } from '@/components/CourseCardSkeleton';

interface TitleComponentProps {
  title: string;
  avatar: string;
}

const TitleComponent = ({ title, avatar }: TitleComponentProps) => (
  <div className="flex items-center space-x-2">
    <Image
      src={avatar}
      height="20"
      width="20"
      alt="thumbnail"
      className="rounded-full border-2 border-white"
    />
    <p>{title}</p>
  </div>
);

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams?.get('q') || '';
  const [results, setResults] = useState<{ courses: Course[], categories: Category[] }>({ 
    courses: [], 
    categories: [] 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);

      try {
        const [coursesResponse, categoriesResponse] = await Promise.all([
          courseService.searchCourses(query),
          categoryService.searchCategories(query)
        ]);

        setResults({
          courses: coursesResponse.courses || [],
          categories: categoriesResponse.data || []
        });
      } catch (error) {
        console.error('Search failed:', error);
        setError('Failed to fetch search results. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-white">Searching...</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <CourseCardSkeleton key={index} />
            ))}
          </div>
        </div>
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

  const { courses, categories } = results;
  const hasNoResults = courses.length === 0 && categories.length === 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-8">
        Search Results for "{query}"
      </h1>

      {/* Categories Section */}
      {categories.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Categories</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.id}`}
                className="bg-gray-800 p-4 rounded-lg hover:bg-gray-700 transition-colors duration-200"
              >
                <h3 className="text-lg font-medium text-white">{category.name}</h3>
                {category.description && (
                  <p className="text-gray-400 mt-2 line-clamp-2">{category.description}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Courses Section */}
      {courses.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <FollowerPointerCard
              key={course.id}
              title={
                <TitleComponent
                  title={course.educatorName || "Anonymous"}
                  avatar={course.educatorPfp || "https://avatar.iran.liara.run/public"}
                />
              }
            >
              <div className="group relative h-full overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 transition duration-200 hover:shadow-xl hover:shadow-black/30">
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-tl-lg rounded-tr-lg bg-gray-700">
                  <Image
                    src={course.thumbnail || "/course/placeholder.png"}
                    alt={`${course.name} thumbnail`}
                    fill
                    className="transform object-cover transition duration-200 group-hover:scale-95 group-hover:rounded-2xl"
                  />
                </div>
                <div className="p-4 flex h-full flex-col">
                  <h2 className="my-4 text-lg font-bold text-white line-clamp-2">
                    {course.name}
                  </h2>
                  <div className="flex flex-col font-normal text-gray-300 gap-1">
                    <p className="text-sm line-clamp-2">{course.about}</p>
                    <p className="text-sm font-normal text-gray-400 line-clamp-2">
                      {course.description}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm leading-none text-gray-400">
                        {course?.start ? new Date(course.start).toLocaleDateString() : 'Date not set'}
                      </span>
                      <span className="text-sm font-semibold text-emerald-600">
                        {Number(course?.price) === 0 ? 'Free' : `₹${course?.price}`}
                      </span>
                    </div>
                    <Link
                      href={`/courses/${course.id}`}
                      className="relative z-10 inline-flex rounded-sm bg-red-600 px-6 py-2 text-xs font-bold text-white transition-colors duration-200 hover:bg-red-700"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </div>
            </FollowerPointerCard>
          ))}
        </div>
      )}

      {hasNoResults && (
        <div className="text-center text-gray-400 py-12">
          <p className="text-xl">No results found for "{query}"</p>
          <p className="mt-2">Try different keywords or check your spelling</p>
        </div>
      )}
    </div>
  );
}
