'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import ai from '@/services/ai.service';
import DoubtReply from '@/components/DoubtReply';

interface DoubtMessage {
  id: string;
  text: string;
  isResponse: boolean;
}

interface DoubtItem {
  id: string;
  title: string;
  description: string;
  status: string;
  resolved: boolean;
  date: string;
  messages: DoubtMessage[];
}

interface ModuleGroup {
  moduleId: string;
  moduleName: string;
  contents: Array<{
    contentId: string;
    contentTitle: string;
    contentType: 'video' | 'study-material';
    doubts: DoubtItem[];
  }>;
}

export default function CourseModuleDoubts({
  courseId,
  canReply = false,
  emptyTitle = 'No doubts yet for this course.'
}: {
  courseId: string;
  canReply?: boolean;
  emptyTitle?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ModuleGroup[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAll();
  }, [courseId]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');
      const aggregate = await ai.listCourseDoubts(courseId);
      setGroups((aggregate.modules || []).map(module => ({
        moduleId: module.id,
        moduleName: module.name,
        contents: module.contents.map(content => ({
          contentId: content.id,
          contentTitle: content.title,
          contentType: content.type === 'video' ? 'video' as const : 'study-material' as const,
          doubts: content.doubts.map(doubt => ({
            id: doubt.id,
            title: doubt.title,
            description: doubt.description,
            status: doubt.status,
            resolved: doubt.status === 'resolved',
            date: '',
            messages: doubt.messages
          }))
        }))
      })));
    } catch (error) {
      console.error('Error fetching course module doubts:', error);
      setError('Doubts could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const totalDoubts = useMemo(
    () =>
      groups.reduce(
        (sum, moduleGroup) =>
          sum + moduleGroup.contents.reduce((innerSum, content) => innerSum + content.doubts.length, 0),
        0
      ),
    [groups]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (error) {
    return <div className="py-8" role="alert"><p className="text-[var(--muted-ink)]">{error}</p><button type="button" className="underline mt-3" onClick={fetchAll}>Retry</button></div>;
  }

  if (groups.length === 0 || totalDoubts === 0) {
    return <div className="text-gray-400 py-6">{emptyTitle}</div>;
  }

  return (
    <div className="space-y-6">
      {groups.map((moduleGroup) => (
         <div key={moduleGroup.moduleId} className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5">
           <h3 className="text-[var(--ink)] text-lg font-semibold mb-4">{moduleGroup.moduleName}</h3>

          <div className="space-y-4">
            {moduleGroup.contents.map((content) => (
               <div key={content.contentId} className="bg-[var(--canvas)] rounded-md p-4">
                <div className="flex items-center justify-between mb-2">
                   <p className="text-sm text-[var(--muted-ink)]">
                    {content.contentType === 'video' ? 'Video' : 'Study Material'}: {content.contentTitle}
                  </p>
                   <span className="text-xs px-2 py-1 rounded-full border border-[var(--line)] text-[var(--muted-ink)]">
                    {content.doubts.length} doubts
                  </span>
                </div>

                {content.doubts.length === 0 ? (
                   <p className="text-xs text-[var(--muted-ink)]">No doubts for this content.</p>
                ) : (
                  <div className="space-y-3">
                    {content.doubts.map((doubt) => (
                       <div key={doubt.id} className="bg-[var(--surface)] rounded p-3 border border-[var(--line)]">
                        <div className="flex justify-between gap-3 mb-1">
                           <h4 className="text-[var(--ink)] font-medium flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-red-400" />
                            {doubt.title}
                          </h4>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              doubt.resolved || doubt.status === 'answered'
                                ? 'bg-green-600 text-white'
                                : 'bg-yellow-600 text-white'
                            }`}
                          >
                            {doubt.resolved || doubt.status === 'answered' ? 'resolved' : 'open'}
                          </span>
                        </div>
                         <p className="text-sm text-[var(--muted-ink)]">{doubt.description}</p>

                        {doubt.messages.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {doubt.messages.map((message) => (
                               <div key={message.id} className="bg-[var(--canvas)] rounded p-2">
                                 <p className="text-sm text-[var(--ink)]">{message.text}</p>
                                 <p className="text-xs text-[var(--muted-ink)] mt-1">
                                  {message.isResponse ? 'Educator response' : 'Student message'}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {canReply && (
                          <DoubtReply
                            doubtId={doubt.id}
                            onReplyAdded={() => {
                              fetchAll();
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
