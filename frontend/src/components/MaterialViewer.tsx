'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { resolveMediaUrl } from '@/utils/mediaUrl';
import LearningAssistant from '@/components/LearningAssistant';

interface MaterialViewerProps {
    fileUrl: string;
    fileType: string;
    title: string;
    onClose: () => void;
    contentId?: string;
    courseId?: string;
}

export default function MaterialViewer({ fileUrl, fileType, title, onClose, contentId, courseId }: MaterialViewerProps) {
    const [loading, setLoading] = useState(true);
    const resolvedUrl = resolveMediaUrl(fileUrl);

    const renderContent = () => {
        const fileTypeLower = fileType.toLowerCase();

        if (fileTypeLower.includes('pdf')) {
            return (
                <iframe
                    src={`${resolvedUrl}#view=fit`}
                    title={title}
                    className="w-full h-[55vh]"
                    onLoad={() => setLoading(false)}
                />
            );
        } else if (fileTypeLower.includes('image')) {
            return (
                <img
                    src={resolvedUrl}
                    alt={title}
                    className="max-w-full max-h-[80vh] object-contain"
                    onLoad={() => setLoading(false)}
                />
            );
        } else if (fileTypeLower.includes('video')) {
            return (
                <video
                    controls
                    className="max-w-full max-h-[80vh]"
                    onLoadedData={() => setLoading(false)}
                >
                    <source src={resolvedUrl} type={fileType} />
                    Your browser does not support the video tag.
                </video>
            );
        } else if (fileTypeLower.includes('audio')) {
            return (
                <audio
                    controls
                    className="w-full"
                    onLoadedData={() => setLoading(false)}
                >
                    <source src={resolvedUrl} type={fileType} />
                    Your browser does not support the audio tag.
                </audio>
            );
        } else {
            // For other file types, provide a download link
            return (
                <div className="text-center p-8">
                    <p className="mb-4">This file type cannot be previewed directly.</p>
                    <a
                        href={resolvedUrl}
                        download
                        className="px-4 py-2 bg-[var(--forest)] text-[var(--action-text)] rounded-lg hover:opacity-90"
                    >
                        Download File
                    </a>
                </div>
            );
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="studio-card w-full max-w-4xl mx-4 max-h-[95vh] overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
                <div className="flex justify-between items-center p-4 border-b border-[var(--line)]">
                    <h3 className="text-xl">{title}</h3>
                    <button
                        onClick={onClose}
                        aria-label="Close material viewer"
                        className="p-2 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-[var(--muted-ink)]" />
                    </button>
                </div>
                
                <div className="p-4">
                    {loading && (
                        <div className="flex justify-center items-center h-12" role="status" aria-label="Loading material">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                        </div>
                    )}
                    {renderContent()}
                    {contentId && <div className="mt-6"><LearningAssistant contentId={contentId} courseId={courseId} title={`Ask about ${title}`} /></div>}
                </div>
            </div>
        </div>
    );
}
