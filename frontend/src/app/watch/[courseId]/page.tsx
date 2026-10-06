import { redirect } from 'next/navigation';

export default async function WatchCourse({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  redirect(`/courses/access/${encodeURIComponent(courseId)}`);
}
