'use client';
import { useRequiredParams } from '@/hooks/useRequiredParams';

import StudyMaterialUpload from '@/components/StudyMaterialUpload';

export default function UploadStudyMaterialPage() {
  const params = useRequiredParams<{ moduleId: string }>();
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-8 text-white">Upload Study Material</h1>
            <div className="max-w-2xl mx-auto">
                <StudyMaterialUpload moduleId={params.moduleId} />
            </div>
        </div>
    );
}
