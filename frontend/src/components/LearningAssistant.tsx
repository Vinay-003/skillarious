'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Loader2, Sparkles, History } from 'lucide-react';
import ai, { AiConversation, AiMessage, LearningResponse, LearningSource } from '@/services/ai.service';
import { useAuth } from '@/context/AuthContext';

type Props = { courseId?: string; contentId?: string; doubtId?: string; title?: string; conversationId?: string; onConversationCreated?: (conversation: AiConversation) => void };
type ChatMessage = Pick<AiMessage, 'id' | 'role' | 'content'> & { sources?: LearningSource[]; model?: string | null; disclosure?: string; fallback?: boolean };

const CATALOG_CONTEXT_ID = '00000000-0000-0000-0000-000000000000';

type AssistantProps = Props & { catalog?: boolean };

function contextFor(props: AssistantProps): { type: AiConversation['contextType']; id: string } | null {
  if (props.catalog) return { type: 'catalog', id: CATALOG_CONTEXT_ID };
  if (props.doubtId) return { type: 'doubt', id: props.doubtId };
  if (props.contentId) return { type: 'content', id: props.contentId };
  if (props.courseId) return { type: 'course', id: props.courseId };
  return null;
}

function storedMessage(message: AiMessage): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    sources: Array.isArray(message.sources) ? message.sources : [],
    model: message.model,
  };
}

export default function LearningAssistant({ courseId, contentId, doubtId, catalog = false, title = 'Learning companion', conversationId, onConversationCreated }: AssistantProps) {
  const { user } = useAuth();
  const context = useMemo(() => contextFor({ courseId, contentId, doubtId, catalog }), [courseId, contentId, doubtId, catalog]);
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState<AiConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadConversation() {
      if (!user || (!context && !conversationId)) return;
      setInitializing(true);
      setError('');
      try {
         const detail = conversationId ? await ai.getConversation(conversationId) : null;
         const listed = conversationId || !context ? null : await ai.listConversations(context.type, context.id, true);
         const current = detail?.conversation || listed?.conversations?.find(item => !item.archived) || listed?.conversations?.[0];
        if (!active || !current) return;
         const currentDetail = detail || await ai.getConversation(current.id);
         if (!active) return;
         setConversation(current || null);
          setMessages(currentDetail.messages.map(storedMessage));
      } catch {
        if (active) setError('Chat history is temporarily unavailable. You can still ask a new question.');
      } finally {
        if (active) setInitializing(false);
      }
    }
    loadConversation();
    return () => { active = false; };
  }, [context, conversationId, user]);

  async function startNewChat() {
    if (!context || busy) return;
    setBusy(true);
    try {
       if (!context) return;
       if (conversation && !conversation.archived) await ai.archiveConversation(conversation.id);
       const created = await ai.createConversation({ contextType: context.type, contextId: context.id, title, forceNew: true });
      setConversation(created.conversation);
      onConversationCreated?.(created.conversation);
      setMessages([]);
      setError('');
    } catch {
      setError('A new chat could not be started. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const asked = question.trim();
    if (busy || !asked) return;
    setBusy(true);
    setError('');
    const temporaryId = `pending-${Date.now()}`;
    setMessages(previous => [...previous, { id: `${temporaryId}-question`, role: 'user', content: asked }]);
    setQuestion('');
    try {
      let activeConversation = conversation;
       if (!activeConversation && context) {
         activeConversation = (await ai.createConversation({ contextType: context.type, contextId: context.id, title: asked.slice(0, 80) })).conversation;
         setConversation(activeConversation);
         onConversationCreated?.(activeConversation);
       }
       if (!activeConversation) throw new Error('Start a chat before asking a question.');
       if (activeConversation.archived) {
         activeConversation = (await ai.restoreConversation(activeConversation.id)).conversation;
         setConversation(activeConversation);
       }
       const contextInput = context?.type === 'course' ? { courseId: context.id } : context?.type === 'content' ? { contentId: context.id } : context?.type === 'doubt' ? { doubtId: context.id } : {};
       const raw = await ai.ask({ question: asked, ...contextInput, conversationId: activeConversation.id });
      const response: LearningResponse = {
        ...raw,
        sources: Array.isArray(raw?.sources) ? raw.sources : [],
        toolReferences: Array.isArray(raw?.toolReferences) ? raw.toolReferences : [],
      };
      setMessages(previous => [...previous, { id: `${temporaryId}-answer`, role: 'assistant', content: response.answer, sources: response.sources, model: response.model, disclosure: response.disclosure, fallback: response.fallback }]);
    } catch (err: any) {
      setMessages(previous => previous.filter(message => !message.id.startsWith(temporaryId)));
      setError(err?.response?.data?.message || 'The learning companion is unavailable. Your educator can still help.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="studio-card p-5 md:p-7 my-6" aria-label="Learning companion">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3"><span className="p-2 bg-[var(--sage)] text-[var(--forest)]"><Sparkles size={21} /></span><div><p className="eyebrow">A little clarity, on demand</p><h3 className="text-2xl mt-1">{title}</h3><p className="text-sm text-[var(--muted-ink)] mt-2">Ask about this course, lesson, material, teacher, or doubt.</p></div></div>
       {user && <div className="flex items-center gap-3">{conversation && <button type="button" onClick={startNewChat} disabled={busy} className="text-sm underline underline-offset-4 disabled:opacity-50">New chat</button>}<Link href="/ask-ai" className="text-sm underline underline-offset-4"><History size={15} className="inline mr-1" />All chats</Link></div>}
    </div>
    {!user ? <p className="mt-5"><Link href="/login" className="underline underline-offset-4">Sign in</Link> to ask your learning companion.</p> : <>
      {initializing && <p className="mt-4 text-sm text-[var(--muted-ink)]" role="status">Loading your previous chat…</p>}
      <div className="mt-5 space-y-4" aria-live="polite">
        {messages.map(message => <div key={message.id} className={message.role === 'user' ? 'ml-auto max-w-[90%] bg-[var(--sage)] p-3 rounded-sm' : 'border-t border-[var(--line)] pt-4'}>
          <p className="text-xs uppercase tracking-wide text-[var(--muted-ink)] mb-1">{message.role === 'user' ? 'You' : 'Learning companion'}</p>
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          {message.role === 'assistant' && message.sources && message.sources.length > 0 && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold flex gap-2 items-center"><BookOpen size={16} /> Sources</summary><div className="mt-3 space-y-3">{message.sources.map(source => <blockquote key={source.id} className="border-l-2 border-[var(--forest)] pl-3 text-sm"><p className="font-semibold">{source.title} · [{source.id}]</p><p className="text-[var(--muted-ink)] mt-1">{source.excerpt}</p></blockquote>)}</div></details>}
          {message.role === 'assistant' && <p className="text-xs text-[var(--muted-ink)] mt-3">{message.disclosure || 'AI explanations can be wrong. Check the sources or ask your educator.'}{message.model ? ` · ${message.model}${message.fallback ? ' (fallback)' : ''}` : ''}</p>}
        </div>)}
      </div>
      <form className="mt-5" onSubmit={ask}>
        <label className="sr-only" htmlFor={`ai-${doubtId || contentId || courseId}`}>Your learning question</label>
        <textarea id={`ai-${doubtId || contentId || courseId}`} value={question} onChange={e => setQuestion(e.target.value)} maxLength={2000} rows={3} placeholder="Ask AI about this learning context…" className="w-full bg-[var(--canvas)] border border-[var(--line)] p-3 rounded-sm resize-y" disabled={busy} />
         <div className="flex justify-between items-center gap-3 mt-3"><span className="text-xs text-[var(--muted-ink)]">{catalog ? 'Public course and teacher information only.' : 'Only authorized learning context is shared. No payment or account tools.'}</span><button type="submit" className="studio-button" disabled={busy || !question.trim()}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {busy ? 'Thinking…' : 'Ask AI'}</button></div>
      </form>
    </>}
    {error && <p role="alert" className="mt-4 p-3 border border-[var(--line)] text-sm">{error}</p>}
    {user && <Link href="/doubts" className="text-sm underline underline-offset-4 mt-4 inline-block">Still unsure? Ask your educator →</Link>}
  </section>;
}
