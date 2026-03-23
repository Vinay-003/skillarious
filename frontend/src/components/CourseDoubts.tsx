'use client';

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Doubt } from '@/types';
import { toast } from 'react-hot-toast';
import { doubtService } from '@/services/doubt.service';

interface DoubtFormData {
    title: string;
    description: string;
    contentId: string;
}

export default function CourseDoubts({ courseId, contentId }: { courseId: string; contentId: string }) {
    const [doubts, setDoubts] = useState<Doubt[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<DoubtFormData>({
        title: '',
        description: '',
        contentId: contentId
    });

    useEffect(() => {
        if (!contentId) {
            setDoubts([]);
            return;
        }
        loadDoubts();
    }, [courseId, contentId]);

    const loadDoubts = async () => {
        try {
            const data = await doubtService.getDoubtsByContent(contentId);
            setDoubts(data.doubts || []);
        } catch (error) {
            toast.error('Failed to load doubts');
        }
    };

    const handleSubmitDoubt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contentId) {
            toast.error('Select course content first to ask a doubt');
            return;
        }
        try {
            const data = await doubtService.createDoubt(
                contentId,
                formData.title,
                formData.description
            );
            setDoubts([...doubts, data.data]);
            setShowForm(false);
            setFormData({ title: '', description: '', contentId });
            toast.success('Doubt posted successfully');
        } catch (error) {
            toast.error('Failed to post doubt');
        }
    };

    return (
        <div className="space-y-6">
            {/* New Doubt Button */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    <Plus className="w-5 h-5" />
                    Ask a Doubt
                </button>
            </div>

            {/* Doubt Form */}
            {showForm && (
                <form onSubmit={handleSubmitDoubt} className="space-y-4 border p-4 rounded-lg">
                    <div>
                        <label className="block mb-2 text-white">Title</label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full p-2 border rounded bg-gray-800 text-white"
                            required
                            minLength={5}
                        />
                    </div>
                    <div>
                        <label className="block mb-2 text-white">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="w-full p-2 border rounded bg-gray-800 text-white"
                            rows={4}
                            required
                            minLength={20}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="px-4 py-2 border rounded hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                            Submit
                        </button>
                    </div>
                </form>
            )}

            {/* Doubts List */}
            <div className="space-y-4">
                {!contentId && (
                    <div className="text-center py-8 text-gray-400">
                        Select a lesson from Course Content to view and post doubts.
                    </div>
                )}
                {doubts.map((doubt) => (
                    <div key={doubt.id} className="border p-4 rounded-lg">
                        <div className="flex items-start justify-between">
                            <div>
                                <h4 className="font-semibold text-white">{doubt.title}</h4>
                                <p className="text-gray-300 mt-1">{doubt.description}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-sm ${
                                doubt.status === 'answered' 
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                            }`}>
                                {doubt.status}
                            </span>
                        </div>
                        {doubt.status === 'answered' && (
                            <div className="mt-4 pl-4 border-l-2">
                                <p className="text-gray-200">{doubt.message}</p>
                            </div>
                        )}
                    </div>
                ))}
                {doubts.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        No doubts posted yet
                    </div>
                )}
            </div>
        </div>
    );
}
