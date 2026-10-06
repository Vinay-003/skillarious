'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Search, Sun, Moon, Monitor, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type Theme = 'light' | 'dark' | 'system';
const links = [{ href: '/courses', label: 'Explore courses' }, { href: '/doubts', label: 'Questions' }, { href: '/dashboard', label: 'My studio' }];
export default function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => { try { const saved = localStorage.getItem('skillarious-theme'); setTheme(saved === 'light' || saved === 'dark' ? saved : 'system'); } catch { /* Use system appearance when storage is blocked. */ } }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (document.documentElement.dataset.theme !== theme) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches));
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
  const changeTheme = (next: Theme) => { try { localStorage.setItem('skillarious-theme', next); } catch { /* Keep in-memory preference. */ } document.documentElement.dataset.theme = next; setTheme(next); };
  const signOut = async () => { setOpen(false); const pending = logout(); router.replace('/login'); await pending; };
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (search.trim()) { router.push(`/search?q=${encodeURIComponent(search.trim())}`); setOpen(false); } };
  return <header className="site-header"><div className="shell header-inner">
    <Link href="/" className="brand" aria-label="Skillarious home"><span className="brand-mark">s<span>.</span></span><span>skillarious</span></Link>
    <nav className="desktop-nav" aria-label="Main navigation">{links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? 'page' : undefined}>{link.label}</Link>)}</nav>
    <div className="header-actions"><form className="header-search" role="search" onSubmit={submit}><label className="sr-only" htmlFor="site-search">Search courses</label><input id="site-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search lessons…" /><button aria-label="Search" type="submit"><Search size={18}/></button></form>
    <div className="theme-control" role="group" aria-label="Appearance"><button type="button" aria-label="Light theme" aria-pressed={theme === 'light'} onClick={() => changeTheme('light')}><Sun size={16}/></button><button type="button" aria-label="Dark theme" aria-pressed={theme === 'dark'} onClick={() => changeTheme('dark')}><Moon size={16}/></button><button type="button" aria-label="System theme" aria-pressed={theme === 'system'} onClick={() => changeTheme('system')}><Monitor size={16}/></button></div>
    <Link className="header-account" href={user ? '/profile' : '/login'}>{user ? 'Account' : 'Sign in'} <ArrowUpRight size={15}/></Link>{user && <button className="header-account" type="button" onClick={signOut}>Sign out</button>}<button className="mobile-toggle" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>{open ? <X/> : <Menu/>}</button></div></div>
    {open && <nav id="mobile-menu" className="mobile-nav" aria-label="Mobile navigation"><div className="shell"><form role="search" onSubmit={submit}><label htmlFor="mobile-search">Find something to learn</label><div className="mobile-search-row"><input id="mobile-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses"/><button type="submit" aria-label="Search"><Search size={19}/></button></div></form>{links.map(link => <Link href={link.href} key={link.href}>{link.label} <ArrowUpRight size={16}/></Link>)}{user?.isEducator && <Link href="/educator">Educator workspace <ArrowUpRight size={16}/></Link>}{user?.isAdmin && <Link href="/admin/dashboard">Administration <ArrowUpRight size={16}/></Link>}<Link href={user ? '/profile' : '/login'}>{user ? 'Your account' : 'Sign in'} <ArrowUpRight size={16}/></Link>{user && <button type="button" onClick={signOut}>Sign out <ArrowUpRight size={16}/></button>}</div></nav>}
  </header>;
}
