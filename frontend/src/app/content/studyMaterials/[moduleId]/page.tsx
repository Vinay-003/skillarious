'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import contentService from '@/services/content.service';
import AuthService from '@/services/auth.service';
import { StudyMaterial } from '@/types';
import { Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import MaterialViewer from '@/components/MaterialViewer';
import ContentDoubtsThread from '@/components/ContentDoubtsThread';

export default function StudyMaterialsPage({
  params
}: {
  params: { moduleId: string }
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterial[]>([]);
  const [isEducator, setIsEducator] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<StudyMaterial | null>(null);
  const [expandedDoubtMaterialId, setExpandedDoubtMaterialId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await checkEducatorStatus();
        await fetchStudyMaterials();
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };
    init();
  }, [params.moduleId]);

  const checkEducatorStatus = async () => {
    try {
      const response = await AuthService.validateSession();
      const user = response.user;
      setIsEducator(user?.isEducator || false);
    } catch (error) {
      console.error('Error checking educator status:', error);
      setIsEducator(false);
    }
  };

  const fetchStudyMaterials = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Debug: Check moduleId
      console.log('Fetching materials for moduleId:', params.moduleId);
      
      if (!params.moduleId) {
        throw new Error('Module ID is required');
      }

      // Debug: Check auth token
      const token = AuthService.getAccessToken();
      console.log('Auth token present:', !!token);

      // Debug: Log API call
      console.log('Making API request to:', `${process.env.NEXT_PUBLIC_API_URL}/content/getModuleStudyMaterials/${params.moduleId}`);

      const response = await contentService.getModuleStudyMaterials(params.moduleId);
      
      // Debug: Log response
      console.log('API Response:', response);

      if (response.success === false && response.message === 'No study materials found for this module') {
        setStudyMaterials([]);
        return;
      }

      if (!response.success) {
        throw new Error(response.message || 'Failed to fetch study materials');
      }

      setStudyMaterials(response.data || []);
    } catch (error: any) {
      // Enhanced error logging
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch study materials';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!confirm('Are you sure you want to delete this study material?')) return;

    try {
      const response = await contentService.deleteStudyMaterial(materialId);
      if (response.success) {
        toast.success('Study material deleted successfully');
        // Remove the deleted material from state
        setStudyMaterials(prev => prev.filter(material => material.id !== materialId));
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete study material');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-red-500/10 text-red-500 p-4 rounded-lg">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Study Materials</h1>
          
          {/* Add Upload button for educators */}
          {isEducator && (
            <button
              onClick={() => router.push(`/content/materials/upload/${params.moduleId}`)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Upload New Material
            </button>
          )}
        </div>

        {/* Study Materials List */}
        <div className="bg-gray-800 rounded-lg p-6">
          {loading ? (
            <div className="flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : studyMaterials.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No study materials available for this module.
            </div>
          ) : (
            <div className="space-y-4">
              {studyMaterials.map((material) => (
                <div key={material.id} className="bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium text-white">
                        {material.title}
                      </h3>
                      {material.description && (
                        <p className="text-sm text-gray-400 mt-1">
                          {material.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedMaterial(material)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        View Material
                      </button>
                      <button
                        onClick={() =>
                          setExpandedDoubtMaterialId((prev) => (prev === material.id ? null : material.id))
                        }
                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
                      >
                        {expandedDoubtMaterialId === material.id ? 'Hide Doubts' : 'Doubts'}
                      </button>
                      {isEducator && (
                        <button
                          onClick={() => handleDeleteMaterial(material.id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete material"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {expandedDoubtMaterialId === material.id && (
                    <ContentDoubtsThread
                      contentId={material.id}
                      contentLabel={material.title}
                      allowAsk={!isEducator}
                      canReply={isEducator}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Material Viewer Modal */}
      {selectedMaterial && (
        <MaterialViewer
          fileUrl={selectedMaterial.fileUrl}
          fileType={selectedMaterial.type}
          title={selectedMaterial.title}
          onClose={() => setSelectedMaterial(null)}
        />
      )}
    </div>
  );
}
