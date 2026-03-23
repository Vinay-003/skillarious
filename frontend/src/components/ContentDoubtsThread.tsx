'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Plus } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { doubtService } from '@/services/doubt.service';
import DoubtReply from '@/components/DoubtReply';

interface DoubtMessage {
  id: string;
  text: string;
  isResponse: boolean;
}

interface ContentDoubt {
  id: string;
  title: string;
  description: string;
  status: string;
  resolved: boolean;
  date: string;
  messages: DoubtMessage[];
}

interface ContentDoubtsThreadProps {
  contentId: string;
  contentLabel?: string;
  allowAsk?: boolean;
  canReply?: boolean;
}

export default function ContentDoubtsThread({
  contentId,
  contentLabel,
  allowAsk = true,
  canReply = false
}: ContentDoubtsThreadProps) {
  const [loading, setLoading] = useState(true);
  const [doubts, setDoubts] = useState<ContentDoubt[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!contentId) return;
    fetchDoubts();
  }, [contentId]);

  const fetchDoubts = async () => {
    try {
      setLoading(true);
      const response = await doubtService.getDoubtsByContent(contentId);
      const baseDoubts = Array.isArray(response?.doubts) ? response.doubts : [];

      const withMessages = await Promise.all(
        baseDoubts.map(async (doubt: any) => {
          try {
            const detail = await doubtService.getDoubtDetails(doubt.id);
            return {
              ...doubt,
              messages: Array.isArray(detail?.doubt?.messages) ? detail.doubt.messages : []
            } as ContentDoubt;
          } catch {
            return {
              ...doubt,
              messages: []
            } as ContentDoubt;
          }
        })
      );

      setDoubts(withMessages);
    } catch (error) {
      console.error('Failed to fetch doubts by content:', error);
      toast.error('Failed to load doubts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDoubt = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      toast.error('Please fill title and description');
      return;
    }

    setIsSubmitting(true);
    try {
      await doubtService.createDoubt(contentId, title.trim(), description.trim());
      toast.success('Doubt posted successfully');
      setTitle('');
      setDescription('');
      setShowForm(false);
      fetchDoubts();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to post doubt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4 bg-gray-800/60 rounded-lg p-4 border border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-white font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Doubts {contentLabel ? `• ${contentLabel}` : ''}
        </h4>
        {allowAsk && (
          <button
            onClick={() => setShowForm((prev) => !prev)}
            className="text-sm px-3 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Ask Doubt
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreateDoubt} className="space-y-3 mb-4 bg-gray-900 rounded-md p-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Doubt title"
            className="w-full px-3 py-2 rounded-md bg-gray-700 text-white"
            minLength={5}
            required
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your doubt"
            rows={3}
            className="w-full px-3 py-2 rounded-md bg-gray-700 text-white"
            minLength={10}
            required
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-2 text-sm rounded-md bg-gray-700 text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-3 py-2 text-sm rounded-md bg-red-600 text-white disabled:opacity-60"
            >
              {isSubmitting ? 'Posting...' : 'Post Doubt'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading doubts...</p>
      ) : doubts.length === 0 ? (
        <p className="text-gray-400 text-sm">No doubts yet for this content.</p>
      ) : (
        <div className="space-y-3">
          {doubts.map((doubt) => (
            <div key={doubt.id} className="bg-gray-700 rounded-md p-3">
              <div className="flex justify-between gap-3 mb-1">
                <h5 className="text-white font-medium">{doubt.title}</h5>
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
                    <div key={message.id} className="bg-gray-800 rounded p-2">
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
                    fetchDoubts();
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
