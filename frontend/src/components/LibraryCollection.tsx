'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import libraryService, { libraryError, LibraryCourse, Playlist, Subscription } from '@/services/library.service';

type Mode = 'history' | 'liked' | 'playlists' | 'subscribed';
const headings: Record<Mode, string> = { history: 'Learning history', liked: 'Liked courses', playlists: 'Playlists', subscribed: 'Following' };
export default function LibraryCollection({ mode }: { mode: Mode }) {
  const { user, loading: authLoading } = useAuth();
  const [courses, setCourses] = useState<LibraryCourse[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [educators, setEducators] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      if (mode === 'history') setCourses(await libraryService.history());
      if (mode === 'liked') setCourses(await libraryService.likes());
      if (mode === 'playlists') setPlaylists(await libraryService.playlists());
      if (mode === 'subscribed') setEducators(await libraryService.subscriptions());
    } catch (e) { setError(libraryError(e)); }
    finally { setLoading(false); }
  }, [user, mode]);
  useEffect(() => { if (!authLoading && user) void load(); }, [authLoading, user, load]);
  async function mutate(action: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await action(); await load(); }
    catch (e) { setError(libraryError(e)); }
    finally { setBusy(false); }
  }
  const courseLink = (course: LibraryCourse) => <Link className="underline" href={`/courses/${course.id}`}>{course.name}</Link>;
  return <main className="shell page-section max-w-5xl mx-auto">
    <p className="eyebrow mb-4">Your studio / Library</p><h1 className="editorial-title mb-8">{headings[mode]}</h1>
    {authLoading ? <p>Checking your session…</p> : !user ? <p>Please <Link className="underline" href="/login">sign in</Link> to view your library.</p> : <>
      {error && <p role="alert" className="text-red-600 mb-4">{error} <button className="underline" onClick={() => void load()}>Retry</button></p>}
      {loading ? <p>Loading your library…</p> : error && !busy ? null : <>
        {mode === 'playlists' && <form className="flex flex-wrap gap-3 mb-8" onSubmit={e => { e.preventDefault(); if (name.trim()) void mutate(async () => { await libraryService.createPlaylist(name.trim()); setName(''); }); }}>
          <input aria-label="Playlist name" className="studio-card p-3" maxLength={120} required value={name} onChange={e => setName(e.target.value)} placeholder="New playlist name" />
          <button disabled={busy || !name.trim()} className="studio-button">Create playlist</button>
        </form>}
        {mode === 'playlists' ? playlists.length ? playlists.map(playlist => <section className="studio-card p-6 mb-5" key={playlist.id}>
          <div className="flex justify-between gap-4"><h2 className="text-2xl">{playlist.name}</h2><button disabled={busy} className="underline" onClick={() => { if (window.confirm(`Delete ${playlist.name}?`)) void mutate(() => libraryService.deletePlaylist(playlist.id)); }}>Delete playlist</button></div>
          {playlist.courses.length ? <ul className="mt-4 space-y-3">{playlist.courses.map(course => <li key={course.id} className="flex justify-between gap-4">{courseLink(course)}<button disabled={busy} className="underline" onClick={() => void mutate(() => libraryService.removeCourse(playlist.id, course.id))}>Remove</button></li>)}</ul> : <p className="mt-4 text-[var(--muted-ink)]">No courses yet. Add one from a course page.</p>}
        </section>) : <p>No playlists yet. Create one above.</p> : null}
        {(mode === 'liked' || mode === 'history') && (courses.length ? <ul className="space-y-4">{courses.map(course => <li className="studio-card p-5 flex justify-between gap-4" key={course.id}><div>{courseLink(course)}<p className="text-[var(--muted-ink)]">{course.educatorName}</p></div>{mode === 'liked' && <button disabled={busy} className="underline" onClick={() => void mutate(() => libraryService.unlike(course.id))}>Unlike</button>}</li>)}</ul> : <p>{mode === 'history' ? 'No learning history yet. Open an enrolled course to begin.' : 'No liked courses yet.'}</p>)}
        {mode === 'subscribed' && (educators.length ? <ul className="space-y-4">{educators.map(educator => <li className="studio-card p-5 flex justify-between gap-4" key={educator.id}><div><h2 className="text-xl">{educator.name}</h2>{educator.bio && <p>{educator.bio}</p>}</div><button disabled={busy} className="underline" onClick={() => void mutate(() => libraryService.unfollow(educator.id))}>Unfollow</button></li>)}</ul> : <p>You are not following any educators yet.</p>)}
      </>}
    </>}
  </main>;
}
