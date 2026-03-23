'use client';

import { useEffect, useState } from 'react';
import ContentService from '@/services/content.service';
import courseService from '@/services/course.service';
import { Module } from '@/types';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AuthService from '@/services/auth.service';

export default function ModulePage({
  params,
}: {
  params: { courseId: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isEducator, setIsEducator] = useState(false);
  const [isCourseOwner, setIsCourseOwner] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    duration: '',
    videoCount: '',
    materialCount: '',
  });
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  useEffect(() => {
    checkEducatorStatus();
    fetchModules();
  }, [params.courseId]);

  const checkEducatorStatus = async () => {
    try {
      const response = await AuthService.validateSession();
      const user = response.user;
      setIsEducator(user?.isEducator || false);

      if (user?.isEducator && params.courseId) {
        const ownership = await courseService.checkCourseOwnership(params.courseId);
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

  const handleInvalidCourse = () => {
    toast.error('Invalid course ID or course not found');
    router.push('/content/courses');
  };

  const fetchModules = async () => {
    try {
      setLoading(true);
      if (!params.courseId) {
        throw new Error('Course ID is required');
      }
      
      console.log('Fetching modules for course:', params.courseId);
      const response = await ContentService.getAllModules(params.courseId);
      
      if (response?.success === false) {
        throw new Error(response.message || 'Failed to fetch modules');
      }
      
      if (!response?.data) {
        setModules([]);
        return;
      }
      
      setModules(response.data);
    } catch (error: any) {
      console.error('Error fetching modules:', error);
      if (error?.response?.status === 404) {
        handleInvalidCourse();
      } else {
        toast.error(error?.response?.data?.message || 'Failed to fetch modules');
      }
      setModules([]);
      setError(error instanceof Error ? error : new Error('Failed to fetch modules'));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // For numeric fields, allow empty string or valid numbers
    if (['duration', 'videoCount', 'materialCount'].includes(name)) {
      if (value === '' || !isNaN(Number(value))) {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCreateModule = async () => {
    try {
      if (!isCourseOwner) {
        toast.error('Only course owner can create modules');
        return;
      }

      if (!params.courseId) {
        toast.error('Course ID is required');
        return;
      }

      setLoading(true);
      const submitData = {
        name: formData.name,
        duration: formData.duration ? Number(formData.duration) : 0,
        videoCount: formData.videoCount ? Number(formData.videoCount) : 0,
        materialCount: formData.materialCount ? Number(formData.materialCount) : 0,
      };
      
      const response = await ContentService.createModule(params.courseId, submitData);
      
      if (response.success) {
        setModules([...modules, response.data]);
        resetForm();
        toast.success('Module created successfully');
      } else {
        throw new Error(response.message || 'Failed to create module');
      }
    } catch (error: any) {
      console.error('Error creating module:', error);
      toast.error(error?.response?.data?.message || 'Failed to create module');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateModule = async () => {
    try {
      if (!isCourseOwner) {
        toast.error('Only course owner can update modules');
        return;
      }

      if (!selectedModule) {
        toast.error('No module selected for update');
        return;
      }
      setLoading(true);
      
      const submitData = {
        name: formData.name,
        duration: formData.duration ? Number(formData.duration) : null,
        videoCount: formData.videoCount ? Number(formData.videoCount) : 0,
        materialCount: formData.materialCount ? Number(formData.materialCount) : 0,
      };

      const response = await ContentService.updateModule(selectedModule.id, submitData);
      
      if (response.success) {
        setModules(modules.map(m => m.id === selectedModule.id ? response.data : m));
        
        toast.success('Module updated successfully');
        resetForm();
        setSelectedModule(response.data);
      } else {
        throw new Error(response.message || 'Failed to update module');
      }
    } catch (error: any) {
      console.error('Error updating module:', error);
      toast.error(error?.response?.data?.message || 'Failed to update module');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    try {
      if (!isCourseOwner) {
        toast.error('Only course owner can delete modules');
        return;
      }

      if (!moduleId) {
        toast.error('Module ID is required');
        return;
      }
      
      setLoading(true);
      const response = await ContentService.deleteModule(moduleId);
      
      if (response.success) {
        setModules(modules.filter(m => m.id !== moduleId));
        toast.success('Module deleted successfully');
        resetForm();
      } else {
        throw new Error(response.message || 'Failed to delete module');
      }
    } catch (error: any) {
      console.error('Error deleting module:', error);
      toast.error(error?.response?.data?.message || 'Failed to delete module');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      duration: '',
      videoCount: '',
      materialCount: '',
    });
  };

  const selectModuleForEdit = (module: Module) => {
    setSelectedModule(module);
    setFormData({
      name: module.name,
      duration: module.duration?.toString() || '',
      videoCount: module.videoCount?.toString() || '',
      materialCount: module.materialCount?.toString() || '',
    });
  };

  const toggleModuleExpansion = (moduleId: string) => {
    setExpandedModuleId(expandedModuleId === moduleId ? null : moduleId);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-white">Course Modules</h1>

        {/* Form Section */}
        {isEducator && isCourseOwner && (
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-white">
              {selectedModule ? 'Edit Module' : 'Create New Module'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-red-500"
                  placeholder="Module name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Duration (hours)</label>
                <input 
                  type="number" 
                  name="duration"
                  value={formData.duration}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-red-500"
                  min="0"
                  step="0.1"  // Allow decimal values if needed
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Video Count</label>
                <input 
                  type="number" 
                  name="videoCount"
                  value={formData.videoCount}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-red-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Material Count</label>
                <input 
                  type="number" 
                  name="materialCount"
                  value={formData.materialCount}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-red-500"
                  min="0"
                />
              </div>
            </div>
            <div className="mt-6 flex gap-4">
              <button
                onClick={selectedModule ? handleUpdateModule : handleCreateModule}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedModule ? 'Update Module' : 'Create Module'}
              </button>
              {selectedModule && (
                <button
                  onClick={() => {
                    setSelectedModule(null);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modules List */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Existing Modules</h2>
          {loading && <Loader2 className="w-8 h-8 animate-spin mx-auto" />}
          {error && (
            <div className="text-red-500 text-center py-4">
              {error.message}
            </div>
          )}
          {!loading && modules.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              No modules available for this course.
            </div>
          )}
          <div className="space-y-4">
            {modules.map((module) => (
              <div key={module.id} className="bg-gray-700 rounded-lg overflow-hidden">
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
                    <div className="flex justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-white">{module.name}</h3>
                        <div className="text-sm text-gray-400 mt-1">
                          Duration: {module.duration}h | Videos: {module.videoCount} | Materials: {module.materialCount}
                        </div>
                      </div>
                      {isEducator && isCourseOwner && (
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectModuleForEdit(module);
                            }}
                            className="p-2 text-gray-400 hover:text-white"
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteModule(module.id);
                            }}
                            className="p-2 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded content */}
                {expandedModuleId === module.id && (
                  <div className="p-4 bg-gray-800">
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
                          onClick={() => router.push(`/content/studyMaterials/${module.id}`)}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          View Study Materials
                        </button>
                        <button
                          onClick={() => router.push(`/content/class/${module.id}`)}
                          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          View Videos
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}




