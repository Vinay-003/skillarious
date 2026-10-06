'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import userService, { type ProfileUpdate } from '@/services/user.service';
import educatorService from '@/services/educator.service';

const empty: ProfileUpdate = { name: '', phone: '', gender: '', age: null };
const message = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
};
const bounded = async <T,>(promise: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Request timed out. Please try again.')), 8000);
    })]);
  } finally { clearTimeout(timer); }
};

export default function ProfilePage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [details, setDetails] = useState<Partial<ProfileUpdate>>({});
  const [educator, setEducator] = useState<{ bio?: string; about?: string; doubtOpen?: boolean }>({});
  const [error, setError] = useState('');
  const [educatorError, setEducatorError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileUpdate>(empty);
  const requestGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    if (!user) { setDetails({}); setEducator({}); return; }
    setBusy(true); setError(''); setEducatorError('');
    const requests = [bounded(userService.getProfile()), ...(user.isEducator ? [bounded(educatorService.getEducatorProfile())] : [])];
    const [profileResult, educatorResult] = await Promise.allSettled(requests);
    if (generation !== requestGeneration.current) return;
    if (profileResult.status === 'fulfilled' && profileResult.value.success && profileResult.value.data) {
      const data = profileResult.value.data;
      setDetails(data);
      setForm({ name: data.name || user.name, phone: data.phone || '', gender: data.gender || '', age: data.age ?? null });
    } else setError(profileResult.status === 'rejected' ? message(profileResult.reason, 'Profile details are unavailable.') : 'Profile details are unavailable.');
    if (educatorResult) {
      if (educatorResult.status === 'fulfilled' && educatorResult.value.success) setEducator(educatorResult.value.data || {});
      else setEducatorError(educatorResult.status === 'rejected' ? message(educatorResult.reason, 'Educator details are unavailable.') : 'Educator details are unavailable.');
    }
    setBusy(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);
  useEffect(() => { void load(); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) { setError('Name is required.'); return; }
    if (form.phone && !/^\+?[1-9]\d{1,14}$/.test(form.phone)) { setError('Enter a valid international phone number.'); return; }
    if (form.age !== null && (!Number.isInteger(form.age) || form.age < 1 || form.age > 120)) { setError('Enter an age between 1 and 120.'); return; }
    setSaving(true); setError('');
    try {
      const result = await bounded(userService.updateProfile({ name, phone: form.phone, gender: form.gender, age: form.age }));
      if (!result.success) throw new Error(result.message || 'Profile could not be saved.');
      setDetails(result.data || { ...details, ...form, name });
      await bounded(refreshUser());
      setEditing(false);
    } catch (cause) { setError(message(cause, 'Profile could not be saved. Please try again.')); }
    finally { setSaving(false); }
  };

  const toggleAvailability = async () => {
    setEducatorError('');
    try {
      const result = await bounded(educatorService.toggleDoubtAvailability());
      if (!result.success) throw new Error(result.message || 'Availability could not be updated.');
      setEducator(previous => ({ ...previous, doubtOpen: result.data?.doubtOpen ?? !previous.doubtOpen }));
    } catch (cause) { setEducatorError(message(cause, 'Availability could not be updated.')); }
  };

  if (authLoading || !user) return <div className="shell page-section" role="status">Checking your session…</div>;
  const name = details.name || user.name;
  const fieldClass = 'w-full rounded border border-[var(--line)] bg-[var(--canvas)] p-3 text-[var(--ink)]';
  return <main className="shell page-section max-w-5xl">
    <p className="eyebrow mb-4">Your learning / Account</p>
    <div className="studio-card p-5 sm:p-8 md:p-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5 min-w-0">
          <div aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--sage)] text-xl font-bold text-[var(--forest)]">{name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || '?'}</div>
          <div className="min-w-0"><p className="eyebrow">Your profile</p><h1 className="text-3xl sm:text-4xl break-words">{name}</h1><p className="break-all text-[var(--muted-ink)]">{user.email}</p></div>
        </div>
        <button type="button" className="studio-button self-start" onClick={() => { setEditing(!editing); setError(''); setForm({ name: details.name || user.name, phone: details.phone || user.phone || '', gender: details.gender || '', age: details.age ?? null }); }}>{editing ? 'Cancel editing' : 'Edit profile'}</button>
      </div>
      {busy && <p role="status" className="mt-6 text-[var(--muted-ink)]">Loading additional details…</p>}
      {error && <div role="alert" className="mt-6 border-l-4 border-red-700 p-4"><p>{error}</p>{!editing && <button className="underline" type="button" onClick={() => void load()}>Retry details</button>}</div>}
      {editing ? <form onSubmit={save} className="mt-8 grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2">Name<input className={fieldClass} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required maxLength={100} /></label>
        <div className="grid gap-2">Email <p className="p-3 border border-[var(--line)] break-all">{user.email}</p></div>
        <label className="grid gap-2">Phone<input className={fieldClass} type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></label>
        <label className="grid gap-2">Age<input className={fieldClass} type="number" min="1" max="120" value={form.age ?? ''} onChange={event => setForm({ ...form, age: event.target.value ? Number(event.target.value) : null })} /></label>
        <label className="grid gap-2">Gender<select className={fieldClass} value={form.gender} onChange={event => setForm({ ...form, gender: event.target.value })}><option value="">Not specified</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
        <div className="sm:col-span-2"><button className="studio-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </form> : <dl className="mt-8 grid gap-6 border-t border-[var(--line)] pt-8 sm:grid-cols-2">{[['Name', name], ['Email', user.email], ['Phone', details.phone || user.phone || 'Not provided'], ['Age', details.age || 'Not provided'], ['Gender', details.gender || 'Not provided']].map(([label, value]) => <div key={label}><dt className="eyebrow mb-2">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl>}
      {user.isEducator && <section className="mt-9 border-t border-[var(--line)] pt-8"><h2 className="text-2xl mb-5">Educator profile</h2>{educatorError && <p role="alert">{educatorError} <button type="button" className="underline" onClick={() => void load()}>Retry details</button></p>}<p className="mb-3">{educator.bio || 'No bio provided'}</p><p className="mb-5">{educator.about || 'No about information provided'}</p><button type="button" className="studio-button studio-button-outline" onClick={() => void toggleAvailability()}>{educator.doubtOpen ? 'Available for doubts' : 'Unavailable for doubts'}</button></section>}
    </div>
  </main>;
}
