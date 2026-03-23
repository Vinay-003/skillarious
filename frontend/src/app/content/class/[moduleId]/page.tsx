'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Class } from '@/types'
import ContentService from '@/services/content.service'
import { toast } from 'react-hot-toast'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { FileUpload } from '@/components/FileUpload'
import ContentDoubtsThread from '@/components/ContentDoubtsThread'
import { resolveMediaUrl } from '@/utils/mediaUrl'

export default function ClassVideosPage({ params }: { params: { moduleId: string } }) {
    const { user } = useAuth()
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [videoProgress, setVideoProgress] = useState<{[key: string]: number}>({});
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleTimeUpdate = (classId: string) => {
        if (videoRef.current) {
            const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
            setVideoProgress(prev => ({...prev, [classId]: progress}));
            
            // Save progress to backend every 5 seconds
            if (Math.floor(videoRef.current.currentTime) % 5 === 0) {
                ContentService.saveVideoProgress(classId, progress);
            }
        }
    };

    useEffect(() => {
        fetchClasses();
    }, [params.moduleId]);

    const fetchClasses = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await ContentService.getModuleClasses(params.moduleId);
            
            if (response.success) {
                setClasses(response.data);
            } else {
                throw new Error(response.message || 'Failed to fetch classes');
            }
        } catch (error: any) {
            const errorMessage = error?.response?.data?.message || error.message || 'Failed to fetch classes';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (file: File) => {
        if (!file) return;

        // Add file size and type validation
        const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
        if (file.size > MAX_FILE_SIZE) {
            toast.error('File size should be less than 100MB');
            return;
        }

        if (!file.type.startsWith('video/')) {
            toast.error('Please upload a valid video file');
            return;
        }

        try {
            setIsUploading(true);
            
            // Create FormData with proper metadata
            const formData = new FormData();
            formData.append('video', file);
            formData.append('moduleId', params.moduleId);
            formData.append('title', `Class ${classes.length + 1}`); // Default title
            formData.append('description', ''); // Optional description
            formData.append('type', 'video'); // Explicitly set type
            formData.append('duration', '0'); // Add default duration
            
            // Track upload progress
            const response = await ContentService.createClass(
                params.moduleId, 
                formData,
                (progress) => {
                    setUploadProgress(Math.round(progress));
                }
            );

            if (response.success) {
                toast.success('Class uploaded successfully');
                await fetchClasses(); // Make sure to await the fetch
            } else {
                throw new Error(response.message || 'Upload failed');
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.message || 'Failed to upload class');
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleDeleteClass = async (classId: string) => {
        if (!confirm('Are you sure you want to delete this class?')) return;
        
        try {
            const response = await ContentService.deleteClass(classId);
            if (response.success) {
                toast.success('Class deleted successfully');
                fetchClasses();
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete class');
        }
    };

    const toggleClassExpansion = (classId: string) => {
        setExpandedClassId(expandedClassId === classId ? null : classId);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-white">Module Videos</h1>
                    
                    {/* Only show upload button for educators/admins */}
                    {(user?.isEducator || user?.isAdmin) && (
                        <div className="flex items-center gap-4">
                            <FileUpload
                                accept="video/*"
                                maxSize={100 * 1024 * 1024} // 100MB
                                onUpload={handleFileUpload}  // Changed to pass the function directly
                                disabled={isUploading}
                                buttonText="Upload New Class"
                            />
                            {isUploading && (
                                <div className="flex items-center gap-2 text-white">
                                    <span>Uploading... {uploadProgress}%</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    {classes.map((cls) => (
                        <div key={cls.id} className="bg-gray-800 rounded-lg overflow-hidden">
                            <div className="flex justify-between items-center p-4">
                                <div 
                                    className="flex items-center space-x-4 cursor-pointer flex-1"
                                    onClick={() => toggleClassExpansion(cls.id)}
                                >
                                    <div className="relative w-32 h-24">
                                        <Image
                                            src="/video-thumbnail-placeholder.jpg"
                                            alt="Video thumbnail"
                                            fill
                                            className="object-cover rounded"
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-medium text-white">Video {cls.order || 1}</h3>
                                        <p className="text-sm text-gray-400">Views: {cls.views}</p>
                                        <p className="text-sm text-gray-400">
                                            Duration: {cls.duration ? new Date(cls.duration).toISOString().substr(11, 8) : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                {/* Only show delete button for educators/admins */}
                                {(user?.isEducator || user?.isAdmin) && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteClass(cls.id);
                                            }}
                                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                                            title="Delete class"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {expandedClassId === cls.id && (
                                <div className="p-4 border-t border-gray-700">
                                    <video
                                        ref={videoRef}
                                        controls
                                        className="w-full rounded-lg"
                                        src={resolveMediaUrl(cls.fileUrl)}
                                        onTimeUpdate={() => handleTimeUpdate(cls.id)}
                                    >
                                        Your browser does not support the video tag.
                                    </video>
                                    <div className="mt-2 w-full bg-gray-700 rounded-full h-2.5">
                                        <div 
                                            className="bg-blue-600 h-2.5 rounded-full" 
                                            style={{width: `${videoProgress[cls.id] || 0}%`}}
                                        ></div>
                                    </div>

                                    <ContentDoubtsThread
                                        contentId={cls.id}
                                        contentLabel={`Video ${cls.order || 1}`}
                                        allowAsk={!user?.isEducator}
                                        canReply={Boolean(user?.isEducator)}
                                    />
                                </div>
                            )}
                        </div>
                    ))}

                    {classes.length === 0 && (
                        <div className="text-center py-8">
                            <p className="text-gray-400">No videos available for this module.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}









