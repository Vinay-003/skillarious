'use client';
import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ArrowUp, Sparkles, Loader2 } from 'lucide-react';
import ai, { LearningResponse } from '@/services/ai.service';
import { useAuth } from '@/context/AuthContext';

type Props = { courseId?: string; contentId?: string; doubtId?: string; title?: string };
export default function LearningAssistant({ courseId, contentId, doubtId, title = 'Learning companion' }: Props) {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<LearningResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const context = doubtId ? { doubtId } : contentId ? { contentId } : { courseId };
  async function ask(event: React.FormEvent) {
    event.preventDefault(); if (busy || !question.trim()) return;
    setBusy(true); setError(''); setResult(null);
    try { setResult(await ai.ask({ ...context, question: question.trim() })); }
    catch (err: any) { setError(err?.response?.data?.message || 'The learning companion is unavailable. Your educator can still help.'); }
    finally { setBusy(false); }
  }
  return <section className="studio-card p-5 md:p-7 my-6" aria-label="Learning companion">
    <div className="flex items-start gap-3"><span className="p-2 bg-[var(--sage)] text-[var(--forest)]"><Sparkles size={21} /></span><div><p className="eyebrow">A little clarity, on demand</p><h3 className="text-2xl mt-1">{title}</h3><p className="text-sm text-[var(--muted-ink)] mt-2">Explain a concept, work through an example, or turn these notes into a study plan.</p></div></div>
    {!user ? <p className="mt-5"><Link href="/login" className="underline underline-offset-4">Sign in</Link> to ask your learning companion.</p> : <form className="mt-5" onSubmit={ask}>
      <label className="sr-only" htmlFor={`ai-${doubtId || contentId || courseId}`}>Your learning question</label>
      <textarea id={`ai-${doubtId || contentId || courseId}`} value={question} onChange={e => setQuestion(e.target.value)} maxLength={2000} rows={3} placeholder="What would you like to understand?" className="w-full bg-[var(--canvas)] border border-[var(--line)] p-3 rounded-sm resize-y" disabled={busy}/>
      <div className="flex justify-between items-center gap-3 mt-3"><span className="text-xs text-[var(--muted-ink)]">Only course context is shared. No payment or account tools.</span><button type="submit" className="studio-button" disabled={busy || !question.trim()}>{busy ? <Loader2 size={16} className="animate-spin"/> : <ArrowUp size={16}/>} {busy ? 'Thinking…' : 'Ask'}</button></div>
    </form>}
    {error && <p role="alert" className="mt-4 p-3 border border-[var(--line)] text-sm">{error}</p>}
    {result && <div aria-live="polite" className="mt-6 border-t border-[var(--line)] pt-5"><p className="whitespace-pre-wrap leading-relaxed">{result.answer}</p><details className="mt-5"><summary className="cursor-pointer text-sm font-semibold flex gap-2 items-center"><BookOpen size={16}/> Sources &amp; read-only context</summary><div className="mt-3 space-y-3">{result.sources.map(source => <blockquote key={source.id} className="border-l-2 border-[var(--forest)] pl-3 text-sm"><p className="font-semibold">{source.title} · [{source.id}]</p><p className="text-[var(--muted-ink)] mt-1">{source.excerpt}</p></blockquote>)}<ul className="text-xs text-[var(--muted-ink)]">{result.toolReferences.map((tool, index) => <li key={index}>{tool.name}: {tool.access}</li>)}</ul></div></details><p className="text-xs text-[var(--muted-ink)] mt-4">{result.disclosure} · {result.model}{result.fallback ? ' (fallback)' : ''}</p><Link href="/doubts" className="text-sm underline underline-offset-4 mt-3 inline-block">Still unsure? Ask your educator →</Link></div>}
  </section>;
}
