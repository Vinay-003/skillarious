import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import './globals.css';

export const metadata: Metadata = { title: 'Skillarious — Learn with intention', description: 'A thoughtful place to learn, practice, and grow.' };
const themeScript = `(function(){try{var t=localStorage.getItem('skillarious-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.dataset.theme=t;}catch(e){}})()`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body><AuthProvider><a className="skip-link" href="#main-content">Skip to content</a><Header /><main id="main-content" className="min-h-screen">{children}</main><Footer /><Toaster position="bottom-center" /></AuthProvider></body></html>;
}
