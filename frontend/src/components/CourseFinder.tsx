'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Compass, Loader2 } from 'lucide-react';
import ai, { Recommendation } from '@/services/ai.service';
import { useAuth } from '@/context/AuthContext';

export default function CourseFinder() {
  const { user } = useAuth();
  const [subject, setSubject] = useState(''); const [results, setResults] = useState<Recommendation[] | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function find(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setResults(null);
    try { setResults((await ai.recommend(subject.trim())).recommendations); }
    catch (err: any) { setError(err?.response?.data?.message || 'Recommendations are unavailable right now. You can still browse the catalog.'); }
    finally { setBusy(false); }
  }
  return <section className="studio-card p-6 md:p-8 my-8"><div className="flex gap-3 items-center"><Compass className="text-[var(--forest)]"/><p className="eyebrow">Find your next chapter</p></div><h2 className="text-3xl mt-3">Less scrolling. More direction.</h2><p className="text-[var(--muted-ink)] mt-2">Tell us a subject or skill. We’ll match real courses and educators using student reviews—not invented rankings.</p>
    {!user ? <p className="mt-5"><Link href="/login" className="underline">Sign in</Link> for personal course discovery.</p> : <form onSubmit={find} className="flex flex-col sm:flex-row gap-3 mt-5"><label className="sr-only" htmlFor="learning-goal">Subject or skill</label><input id="learning-goal" value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} placeholder="e.g. Python, interface design, statistics" className="flex-1 min-w-0 p-3 border border-[var(--line)] bg-[var(--canvas)]"/><button className="studio-button" disabled={busy || subject.trim().length < 2}>{busy ? <Loader2 className="animate-spin" size={16}/> : <ArrowUpRight size={16}/>} Find my courses</button></form>}
    {error && <p role="alert" className="mt-4 text-sm">{error}</p>}{results && <div aria-live="polite" className="mt-6 space-y-3">{!results.length && <p>No matches yet. Try a more specific subject, or explore the catalog.</p>}{results.map(course => <Link key={course.id} href={`/courses/${course.id}`} className="block border-t border-[var(--line)] py-4"><div className="flex justify-between gap-3"><h3 className="text-xl">{course.name}</h3><ArrowUpRight size={20}/></div><p className="text-sm mt-1">With {course.educatorName} · {Number(course.price) === 0 ? 'Free' : `$${Number(course.price).toFixed(2)} USD`}</p><p className="text-xs text-[var(--muted-ink)] mt-2">{course.reason}</p></Link>)}</div>}
  </section>;
}
