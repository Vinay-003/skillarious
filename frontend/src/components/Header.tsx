'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Header() {
  const { user } = useAuth();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setIsMobileMenuOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleLogout = () => {
    setIsProfileMenuOpen(false);
    setIsMobileMenuOpen(false);
    router.push('/logout');
    router.refresh();
  };

  const accountLinks = (
    <>
      <Link
        href="/profile"
        className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
        onClick={() => {
          setIsProfileMenuOpen(false);
          setIsMobileMenuOpen(false);
        }}
      >
        Profile
      </Link>
      {user?.isEducator ? (
        <>
          <Link
            href="/educator"
            className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
            onClick={() => {
              setIsProfileMenuOpen(false);
              setIsMobileMenuOpen(false);
            }}
          >
            Courses Taught
          </Link>
          <Link
            href="/enrolledCourses"
            className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
            onClick={() => {
              setIsProfileMenuOpen(false);
              setIsMobileMenuOpen(false);
            }}
          >
            My Courses
          </Link>
        </>
      ) : (
        <Link
          href="/enrolledCourses"
          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
          onClick={() => {
            setIsProfileMenuOpen(false);
            setIsMobileMenuOpen(false);
          }}
        >
          My Courses
        </Link>
      )}
      <button
        onClick={handleLogout}
        className="block w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
      >
        Logout
      </button>
    </>
  );

  return (
    <nav className="fixed z-50 w-full border-b border-gray-800 bg-black/60 backdrop-blur-sm">
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center space-x-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-gray-700 text-xl font-bold text-white/90">LS</div>
          <span className="font-semibold text-white">Learn Sphere</span>
        </Link>

        <form onSubmit={handleSearch} className="relative hidden max-w-2xl flex-1 md:block">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses and categories..."
            className="w-full rounded-lg bg-gray-800 px-4 py-2 pr-20 text-white focus:outline-none focus:ring-2 focus:ring-red-600"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-10 top-2.5 text-gray-400 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-5 w-5" />
            </button>
          )}
          <button
            type="submit"
            className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
            aria-label="Submit search"
          >
            <Search className="h-5 w-5" />
          </button>
        </form>

        <div className="hidden items-center gap-4 md:flex">
          {user?.isEducator && (
            <Link href="/profile" className="text-white hover:text-gray-300">
              Educator Profile
            </Link>
          )}

          {user ? (
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="rounded-full bg-[#FF6B6B] px-4 py-2 text-white transition-colors hover:bg-[#FF5252]"
                aria-haspopup="menu"
                aria-expanded={isProfileMenuOpen}
                aria-label="Account menu"
              >
                {user.email[0].toUpperCase()}
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-gray-800 py-2 shadow-lg" role="menu">
                  {accountLinks}
                </div>
              )}
            </div>
          ) : (
            <Link href="/login" className="rounded-md bg-[#FF6B6B] px-4 py-2 text-white transition-colors hover:bg-[#FF5252]">
              Login
            </Link>
          )}
        </div>

        <button
          type="button"
          className="text-white md:hidden"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          aria-label="Toggle mobile menu"
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="border-t border-gray-800 bg-gray-900 px-4 pb-4 pt-3 md:hidden">
          <form onSubmit={handleSearch} className="relative mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search courses and categories..."
              className="w-full rounded-lg bg-gray-800 px-4 py-2 pr-20 text-white focus:outline-none focus:ring-2 focus:ring-red-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-10 top-2.5 text-gray-400 hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
              aria-label="Submit search"
            >
              <Search className="h-5 w-5" />
            </button>
          </form>

          <div className="space-y-2">
            <Link href="/" className="block rounded-md px-3 py-2 text-white hover:bg-gray-800" onClick={() => setIsMobileMenuOpen(false)}>
              Home
            </Link>

            {user?.isEducator && (
              <Link href="/profile" className="block rounded-md px-3 py-2 text-white hover:bg-gray-800" onClick={() => setIsMobileMenuOpen(false)}>
                Educator Profile
              </Link>
            )}

            {user ? (
              <div className="rounded-md border border-gray-700 py-1">{accountLinks}</div>
            ) : (
              <Link
                href="/login"
                className="block rounded-md bg-[#FF6B6B] px-3 py-2 text-center text-white hover:bg-[#FF5252]"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
