'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { resolveMediaUrl } from '@/utils/mediaUrl';

interface MaterialViewerProps {
    fileUrl: string;
    fileType: string;
    title: string;
    onClose: () => void;
}

export default function MaterialViewer({ fileUrl, fileType, title, onClose }: MaterialViewerProps) {
    const [loading, setLoading] = useState(true);
    const resolvedUrl = resolveMediaUrl(fileUrl);

    const renderContent = () => {
        const fileTypeLower = fileType.toLowerCase();

        if (fileTypeLower.includes('pdf')) {
            return (
                <iframe
                    src={`${resolvedUrl}#view=fit`}
                    className="w-full h-[80vh]"
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
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                        Download File
                    </a>
                </div>
            );
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg w-full max-w-4xl mx-4">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h3 className="text-xl font-semibold text-white">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>
                
                <div className="p-4">
                    {loading && (
                        <div className="flex justify-center items-center h-[80vh]">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                        </div>
                    )}
                    {renderContent()}
                </div>
            </div>
        </div>
    );
}