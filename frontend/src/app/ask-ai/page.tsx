'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, MessageSquare, Sparkles } from 'lucide-react';
import ai, { AiConversation } from '@/services/ai.service';
import LearningAssistant from '@/components/LearningAssistant';
import { useAuth } from '@/context/AuthContext';

export default function AskAiPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [selected, setSelected] = useState<AiConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { const result = await ai.listConversations(undefined, undefined, true); setConversations(result.conversations || []); setSelected(current => current || result.conversations?.[0] || null); }
    catch { setError('Chat history is temporarily unavailable.'); } finally { setLoading(false); }
  }
  async function startCatalogChat() {
    setError('');
    try {
      const result = await ai.createConversation({ contextType: 'catalog', contextId: '00000000-0000-0000-0000-000000000000', title: 'Public course catalog', forceNew: true });
      setConversations(previous => [result.conversation, ...previous]);
      setSelected(result.conversation);
    } catch { setError('A new public chat could not be started. Please try again.'); }
  }
  useEffect(() => { if (user) load(); else setLoading(false); }, [user]);
  if (!user) return <main className="shell py-16"><h1 className="text-4xl">Ask AI</h1><p className="mt-4">Sign in to keep your learning conversations.</p></main>;
  return <main className="shell py-8 md:py-12"><div className="flex items-end justify-between gap-4"><div><p className="eyebrow">Your learning workspace</p><h1 className="text-4xl md:text-5xl mt-2">Ask AI</h1><p className="text-[var(--muted-ink)] mt-3 max-w-2xl">Return to a conversation or start with public course and teacher information.</p></div><Sparkles className="text-[var(--forest)]" size={30} /></div>
     <div className="grid lg:grid-cols-[280px_1fr] gap-6 mt-8"><aside className="studio-card p-4" aria-label="Conversation history"><div className="flex justify-between items-center"><h2 className="font-semibold">Conversation history</h2><button className="text-sm underline" onClick={startCatalogChat}>New public chat</button></div>{loading ? <p role="status" className="mt-5 text-sm"><Loader2 className="inline animate-spin" size={15}/> Loading chats…</p> : error ? <div className="mt-5"><p role="alert" className="text-sm">{error}</p><button className="underline text-sm mt-3" onClick={load}>Retry</button></div> : conversations.length === 0 ? <p className="mt-5 text-sm text-[var(--muted-ink)]">No saved chats yet.</p> : <ul className="mt-4 space-y-1">{conversations.map(chat => <li key={chat.id}><button onClick={() => setSelected(chat)} className={`w-full text-left p-3 rounded-sm ${selected?.id === chat.id ? 'bg-[var(--sage)]' : 'hover:bg-[var(--canvas)]'}`}><MessageSquare size={15} className="inline mr-2" />{chat.title}{chat.archived && <span className="ml-2 text-xs">(archived)</span>}<span className="block text-xs text-[var(--muted-ink)] mt-1">{chat.contextType} · {new Date(chat.updatedAt).toLocaleDateString()}</span></button></li>)}</ul>}<p className="text-xs text-[var(--muted-ink)] mt-6">History includes saved chats available to your account. Private course material is never sent unless the server authorizes your access.</p></aside>
       <section>{selected ? <LearningAssistant key={selected.id} conversationId={selected.id} catalog={selected.contextType === 'catalog'} courseId={selected.contextType === 'course' ? selected.contextId : undefined} contentId={selected.contextType === 'content' ? selected.contextId : undefined} doubtId={selected.contextType === 'doubt' ? selected.contextId : undefined} title={selected.title} onConversationCreated={chat => setConversations(previous => [chat, ...previous])} /> : <div className="studio-card p-6"><h2 className="text-2xl">Start a public catalog chat</h2><p className="mt-2 text-sm text-[var(--muted-ink)]">Ask about public course overviews, teachers, and the available catalog. This chat cannot read paid lessons, private doubts, or protected course materials.</p><button type="button" className="studio-button mt-5" onClick={startCatalogChat}>Start public chat</button><p className="mt-4 text-sm">Explore the <Link className="underline" href="/courses">course catalog</Link> for more context.</p></div>}</section>
    </div></main>;
}
