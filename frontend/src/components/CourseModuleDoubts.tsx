'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { toast } from 'react-hot-toast';
import contentService from '@/services/content.service';
import { doubtService } from '@/services/doubt.service';
import DoubtReply from '@/components/DoubtReply';

interface ModuleItem {
  id: string;
  name: string;
}

interface ContentItem {
  id: string;
  title: string;
  type: 'video' | 'study-material';
}

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

  useEffect(() => {
    fetchAll();
  }, [courseId]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const modulesResponse = await contentService.getAllModules(courseId);
      const modules: ModuleItem[] = Array.isArray(modulesResponse?.data) ? modulesResponse.data : [];

      const moduleGroups = await Promise.all(
        modules.map(async (module) => {
          const [classesRes, materialsRes] = await Promise.all([
            contentService.getModuleClasses(module.id).catch(() => ({ data: [] })),
            contentService.getModuleStudyMaterials(module.id).catch(() => ({ data: [] }))
          ]);

          const classItems: ContentItem[] = (Array.isArray(classesRes?.data) ? classesRes.data : []).map((item: any) => ({
            id: item.id,
            title: item.title || 'Untitled Video',
            type: 'video'
          }));

          const materialItems: ContentItem[] = (Array.isArray(materialsRes?.data) ? materialsRes.data : []).map((item: any) => ({
            id: item.id,
            title: item.title || 'Untitled Material',
            type: 'study-material'
          }));

          const contents = [...classItems, ...materialItems];

          const contentGroups = await Promise.all(
            contents.map(async (content) => {
              const doubtsRes = await doubtService.getDoubtsByContent(content.id).catch(() => ({ doubts: [] }));
              const baseDoubts = Array.isArray(doubtsRes?.doubts) ? doubtsRes.doubts : [];

              const doubtsWithMessages = await Promise.all(
                baseDoubts.map(async (doubt: any) => {
                  const details = await doubtService.getDoubtDetails(doubt.id).catch(() => ({ doubt: { messages: [] } }));
                  return {
                    id: doubt.id,
                    title: doubt.title,
                    description: doubt.description,
                    status: doubt.status,
                    resolved: Boolean(doubt.resolved),
                    date: doubt.date,
                    messages: Array.isArray(details?.doubt?.messages) ? details.doubt.messages : []
                  } as DoubtItem;
                })
              );

              return {
                contentId: content.id,
                contentTitle: content.title,
                contentType: content.type,
                doubts: doubtsWithMessages
              };
            })
          );

          return {
            moduleId: module.id,
            moduleName: module.name,
            contents: contentGroups
          } as ModuleGroup;
        })
      );

      setGroups(moduleGroups);
    } catch (error) {
      console.error('Error fetching course module doubts:', error);
      toast.error('Failed to load doubts');
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

  if (groups.length === 0 || totalDoubts === 0) {
    return <div className="text-gray-400 py-6">{emptyTitle}</div>;
  }

  return (
    <div className="space-y-6">
      {groups.map((moduleGroup) => (
        <div key={moduleGroup.moduleId} className="bg-gray-800 rounded-lg p-5">
          <h3 className="text-white text-lg font-semibold mb-4">{moduleGroup.moduleName}</h3>

          <div className="space-y-4">
            {moduleGroup.contents.map((content) => (
              <div key={content.contentId} className="bg-gray-700 rounded-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-300">
                    {content.contentType === 'video' ? 'Video' : 'Study Material'}: {content.contentTitle}
                  </p>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-600 text-gray-200">
                    {content.doubts.length} doubts
                  </span>
                </div>

                {content.doubts.length === 0 ? (
                  <p className="text-xs text-gray-400">No doubts for this content.</p>
                ) : (
                  <div className="space-y-3">
                    {content.doubts.map((doubt) => (
                      <div key={doubt.id} className="bg-gray-800 rounded p-3">
                        <div className="flex justify-between gap-3 mb-1">
                          <h4 className="text-white font-medium flex items-center gap-2">
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
                        <p className="text-sm text-gray-300">{doubt.description}</p>

                        {doubt.messages.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {doubt.messages.map((message) => (
                              <div key={message.id} className="bg-gray-700 rounded p-2">
                                <p className="text-sm text-gray-100">{message.text}</p>
                                <p className="text-xs text-gray-400 mt-1">
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
