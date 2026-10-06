'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LogoutPage() {
  const { logout, user } = useAuth();
  const router = useRouter();
  const signOut = async () => { await logout(); router.replace('/login'); };

  return <main className="shell py-20 text-center">
    <h1 className="text-2xl font-bold">Sign out</h1>
    <p className="mt-4">{user ? 'Ready to sign out of your account?' : 'You are not signed in.'}</p>
    {user ? <button type="button" className="mt-6 rounded-lg border px-5 py-3 font-semibold" onClick={signOut}>Sign out</button> : <a className="mt-6 inline-block rounded-lg border px-5 py-3 font-semibold" href="/login">Sign in</a>}
  </main>;
}
