import Link from 'next/link';

export default function UnavailableCollection({ title, description }: { title: string; description: string }) {
  return <section className="shell page-section"><p className="eyebrow mb-5">Your studio / Preview</p><h1 className="editorial-title mb-8">{title}</h1><div className="studio-card max-w-2xl p-8"><p className="text-[var(--muted-ink)] leading-relaxed mb-6">{description} This collection is a preview; nothing is saved to your account yet.</p><Link className="studio-button" href="/courses">Browse real courses</Link></div></section>;
}
