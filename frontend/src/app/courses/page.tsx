'use client';
import { useEffect, useState } from 'react';
import courseService from '@/services/course.service';
import type { Course } from '@/types';
import StudioCourseCard from '@/components/StudioCourseCard';
import CourseFinder from '@/components/CourseFinder';
export default function CoursesPage() {
 const [courses,setCourses]=useState<Course[]>([]); const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
 const load=()=>{setState('loading');courseService.getAllCourses().then(r=>{if(r.success===false)throw Error(r.message);setCourses(r.courses||r.data||[]);setState('ready')}).catch(()=>setState('error'))};
 useEffect(load,[]);
 return <div className="shell page-section"><p className="eyebrow mb-5">The collection / Learn at your own pace</p><div className="flex flex-wrap items-end justify-between gap-5 mb-12"><div><h1 className="editorial-title">Explore courses.</h1><p className="lede mt-5">Find something worth getting curious about.</p></div>{state==='ready'&&<span className="text-sm text-[var(--muted-ink)]">{courses.length} {courses.length===1?'course':'courses'} available</span>}</div><CourseFinder />{state==='loading'?<p role="status" className="py-16">Loading the collection…</p>:state==='error'?<div className="studio-card p-8" role="alert"><h2 className="text-2xl">The catalog couldn&apos;t be loaded.</h2><p className="my-3 text-[var(--muted-ink)]">Please check your connection and try again. No preview courses are shown as real listings.</p><button className="studio-button" onClick={load}>Try again</button></div>:courses.length?<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{courses.map((course,i)=><StudioCourseCard key={course.id} course={course} index={i}/>)}</div>:<div className="studio-card p-10"><h2 className="text-2xl">The collection is still growing.</h2><p className="mt-2 text-[var(--muted-ink)]">There are no published courses yet.</p></div>}</div>;
}
