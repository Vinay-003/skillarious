'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Plus, RefreshCw } from 'lucide-react';
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
  const [error, setError] = useState(false);
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
      setError(false);
      const response = await doubtService.getDoubtsByContent(contentId);
      if (response.success === false) throw new Error(response.message || 'Unable to load questions');
      const baseDoubts = Array.isArray(response?.doubts) ? response.doubts : [];

      setDoubts(baseDoubts.map((doubt: any) => ({ ...doubt, messages: Array.isArray(doubt.messages) ? doubt.messages : [] })) as ContentDoubt[]);
    } catch (error) {
      setError(true);
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
      await fetchDoubts();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to post doubt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4 bg-[var(--surface)] rounded-lg p-4 border border-[var(--line)]">
       <div className="flex justify-between items-center mb-3">
         <h4 className="text-[var(--ink)] font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Doubts {contentLabel ? `• ${contentLabel}` : ''}
        </h4>
         <div className="flex gap-2"> <button type="button" onClick={fetchDoubts} className="text-sm px-2 py-1 text-[var(--muted-ink)]" aria-label="Refresh doubts"><RefreshCw className="w-4 h-4" /></button>{allowAsk && (
          <button
            onClick={() => setShowForm((prev) => !prev)}
             className="text-sm px-3 py-1 rounded-md bg-[var(--forest)] text-[var(--action-text)] hover:opacity-90 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Ask Doubt
          </button>
         )}</div>
       </div>

      {showForm && (
         <form onSubmit={handleCreateDoubt} className="space-y-3 mb-4 bg-[var(--canvas)] rounded-md p-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Doubt title"
             className="w-full px-3 py-2 rounded-md bg-[var(--paper)] text-[var(--ink)] border border-[var(--line)]"
            minLength={5}
            required
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your doubt"
            rows={3}
             className="w-full px-3 py-2 rounded-md bg-[var(--paper)] text-[var(--ink)] border border-[var(--line)]"
            minLength={10}
            required
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
               className="px-3 py-2 text-sm rounded-md border border-[var(--line)] text-[var(--ink)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
               className="px-3 py-2 text-sm rounded-md bg-[var(--forest)] text-[var(--action-text)] disabled:opacity-60"
            >
              {isSubmitting ? 'Posting...' : 'Post Doubt'}
            </button>
          </div>
        </form>
      )}

      {error ? <p role="alert" className="text-[var(--muted-ink)]">Questions could not be loaded. Please try again later.</p> : loading ? (
         <p className="text-[var(--muted-ink)] text-sm">Loading doubts...</p>
      ) : doubts.length === 0 ? (
         <p className="text-[var(--muted-ink)] text-sm">No doubts yet for this content.</p>
       ) : (
        <div className="space-y-3">
          {doubts.map((doubt) => (
             <div key={doubt.id} className="bg-[var(--paper)] rounded-md p-3 border border-[var(--line)]">
              <div className="flex justify-between gap-3 mb-1">
                 <h5 className="text-[var(--ink)] font-medium">{doubt.title}</h5>
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
