'use client';

import { useState, useEffect } from 'react';
import { Module } from '@/types';
import ContentService from '@/services/content.service';
import AuthService from '@/services/auth.service';
import courseService from '@/services/course.service';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface CourseContentProps {
  courseId: string;
}

export default function CourseContent({ courseId }: CourseContentProps) {
  const router = useRouter();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);
  const [isEducator, setIsEducator] = useState(false);
  const [isCourseOwner, setIsCourseOwner] = useState(false);

  useEffect(() => {
    fetchModules();
    checkEducatorStatus();
  }, [courseId]);

  const checkEducatorStatus = async () => {
    try {
      const response = await AuthService.validateSession();
      const user = response.user;
      setIsEducator(user?.isEducator || false);

      if (user?.isEducator) {
        const ownership = await courseService.checkCourseOwnership(courseId);
        setIsCourseOwner(Boolean(ownership?.isOwner));
      } else {
        setIsCourseOwner(false);
      }
    } catch (error) {
      console.error('Error checking educator status:', error);
      setIsEducator(false);
      setIsCourseOwner(false);
    }
  };

  const fetchModules = async () => {
    try {
      setLoading(true);
      const response = await ContentService.getAllModules(courseId);
      if (response.success) {
        setModules(response.data);
      } else {
        throw new Error(response.message);
      }
    } catch (error: any) {
      setError(error.message);
      toast.error('Failed to load course content');
    } finally {
      setLoading(false);
    }
  };

  const toggleModuleExpansion = (moduleId: string) => {
    setExpandedModuleId(expandedModuleId === moduleId ? null : moduleId);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {modules.map((module) => (
        <div key={module.id} className="bg-gray-800 rounded-lg overflow-hidden">
          <div 
            className="flex cursor-pointer"
            onClick={() => toggleModuleExpansion(module.id)}
          >
            <div className="relative w-48 h-32">
              <Image
                src={module.thumbnail || '/placeholder-module.jpg'}
                alt={module.name}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
            <div className="flex-1 p-4">
              <div>
                <h3 className="text-lg font-medium text-white">{module.name}</h3>
                <div className="text-sm text-gray-400 mt-1">
                  Duration: {module.duration}h | Videos: {module.videoCount} | Materials: {module.materialCount}
                </div>
              </div>
            </div>
          </div>

          {/* Expanded content */}
          {expandedModuleId === module.id && (
            <div className="p-4 bg-gray-700">
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-400">Duration</h4>
                    <p className="text-white">{module.duration} hours</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-400">Video Count</h4>
                    <p className="text-white">{module.videoCount} videos</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-400">Materials</h4>
                    <p className="text-white">{module.materialCount} materials</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/content/studyMaterials/${module.id}`);
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    {isEducator && isCourseOwner ? 'Manage Study Materials' : 'View Study Materials'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/content/class/${module.id}`);
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    {isEducator && isCourseOwner ? 'Manage Videos' : 'View Videos'}
                  </button>
                  {isEducator && isCourseOwner && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/educator/module/edit/${module.id}`);
                      }}
                      className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                    >
                      Edit Module
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      {modules.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          No content available for this course yet.
        </div>
      )}
      {isEducator && isCourseOwner && (
        <button
          onClick={() => router.push(`/educator/module/create/${courseId}`)}
          className="fixed bottom-4 right-4 bg-red-600 text-white p-4 rounded-full hover:bg-red-700"
        >
          Add New Module
        </button>
      )}
    </div>
  );
}



