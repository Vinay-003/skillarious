'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CourseReviews from '@/components/CourseReviews';
import CourseModuleDoubts from '@/components/CourseModuleDoubts';
import CourseContent from '@/components/CourseContent';

interface PageProps {
  params: {
    courseId: string;
  };
}

export default function CoursePage({ params }: PageProps) {
  return (
    <Tabs defaultValue="content" className="space-y-4">
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
        <div className="text-white font-semibold">Course Overview</div>
      </TabsContent>

      <TabsContent value="notes">
        <div className="text-white font-semibold">My Notes</div>
      </TabsContent>
    </Tabs>
  );
}
