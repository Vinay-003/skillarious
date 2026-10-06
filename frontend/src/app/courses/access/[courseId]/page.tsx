'use client';
import { useRequiredParams } from '@/hooks/useRequiredParams';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import libraryService, { libraryError } from '@/services/library.service';

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CourseReviews from '@/components/CourseReviews';
import CourseModuleDoubts from '@/components/CourseModuleDoubts';
import CourseContent from '@/components/CourseContent';
import LearningAssistant from '@/components/LearningAssistant';

export default function CoursePage() {
  const params = useRequiredParams<{ courseId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [historyError, setHistoryError] = useState('');
  useEffect(() => {
    if (!authLoading && user) {
      libraryService.recordHistory(params.courseId).catch(error => setHistoryError(libraryError(error)));
    }
  }, [authLoading, user, params.courseId]);
  return (
    <div className="shell page-section"><p className="eyebrow mb-5">Your studio / Course</p><h1 className="editorial-title mb-10">Keep learning.</h1>{historyError && <p role="alert" className="text-red-600 mb-4">History could not be recorded: {historyError}</p>}<Tabs defaultValue="content" className="space-y-4">
      <TabsList className="bg-gray-800">
        <TabsTrigger value="content" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Course Content</TabsTrigger>
        <TabsTrigger value="overview" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Overview</TabsTrigger>
        <TabsTrigger value="doubts" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Doubts</TabsTrigger>
        <TabsTrigger value="reviews" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">Reviews</TabsTrigger>
        <TabsTrigger value="notes" className="data-[state=active]:bg-red-600 data-[state=active]:text-white">My Notes</TabsTrigger>
      </TabsList>

      <TabsContent value="content">
        <CourseContent courseId={String(params.courseId)} />
      </TabsContent>

      <TabsContent value="doubts">
        <h2 className="text-xl font-semibold text-white mb-4">Doubts</h2>
        <CourseModuleDoubts courseId={String(params.courseId)} />
      </TabsContent>

      <TabsContent value="reviews">
        <h2 className="text-xl font-semibold text-white mb-4">Reviews</h2>
        <CourseReviews courseId={String(params.courseId)} />
      </TabsContent>

      <TabsContent value="overview">
        <div className="studio-card p-8"><h2 className="text-2xl mb-3">Your course overview</h2><p className="text-[var(--muted-ink)]">Explore lessons and materials in the course content tab.</p></div>
        <LearningAssistant courseId={String(params.courseId)} title="Understand this course" />
      </TabsContent>

      <TabsContent value="notes">
        <div className="studio-card p-8"><h2 className="text-2xl mb-3">Study materials</h2><p className="text-[var(--muted-ink)]">Open a module in Course Content to view its available notes and resources.</p></div>
      </TabsContent>
    </Tabs></div>
  );
}
