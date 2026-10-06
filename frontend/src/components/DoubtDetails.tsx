import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { doubtService } from '@/services/doubt.service';
import { Doubt, Message } from '@/types';
import DoubtReply from './DoubtReply';
import LearningAssistant from '@/components/LearningAssistant';

interface DoubtDetailsProps {
  doubtId: string;
}

export default function DoubtDetails({ doubtId }: DoubtDetailsProps) {
  const [doubt, setDoubt] = useState<Doubt | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    fetchDoubtDetails();
  }, [doubtId]);

  const fetchDoubtDetails = async () => {
    try {
      const response = await doubtService.getDoubtDetails(doubtId);
      setDoubt(response.doubt);
      setMessages(response.doubt.messages || []);
    } catch (error) {
      toast.error('Failed to fetch doubt details');
    } finally {
      setLoading(false);
    }
  };

  const handleReplyAdded = (newMessage: Message) => {
    setMessages(prev => [...prev, newMessage]);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!doubt) {
    return <div className="text-[var(--ink)]">Doubt not found</div>;
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-6">
      <h2 className="text-xl font-bold text-[var(--ink)] mb-2">{doubt.title}</h2>
      <p className="text-[var(--muted-ink)] mb-4">{doubt.description}</p>
      
      <div className="space-y-4 mt-6">
        <h3 className="text-lg font-semibold text-[var(--ink)]">Responses</h3>
        {messages.map((message) => (
          <div key={message.id} className="bg-[var(--canvas)] border border-[var(--line)] p-4 rounded-lg">
            <p className="text-[var(--ink)]">{message.text}</p>
            <p className="text-sm text-[var(--muted-ink)] mt-2">
              {message.isResponse ? 'Educator' : 'Student'}
            </p>
          </div>
        ))}
      </div>

      {!doubt.resolved && <DoubtReply doubtId={doubtId} onReplyAdded={handleReplyAdded} />}
      {doubt.resolved ? <p className="mt-4 text-sm">Resolved. Your conversation is saved.</p> : <button type="button" className="studio-button studio-button-outline mt-4" disabled={resolving} onClick={async () => { setResolving(true); try { await doubtService.resolveDoubt(doubtId); setDoubt({ ...doubt, resolved: true, status: 'resolved' }); } catch { toast.error('Could not resolve this question'); } finally { setResolving(false); } }}>{resolving ? 'Saving…' : 'Mark resolved'}</button>}
      <LearningAssistant doubtId={doubtId} title={`Explore: ${doubt.title}`} />
    </div>
  );
}
