import Image from 'next/image';
import Link from 'next/link';

export default function LandingHero() {
  return (
    <section className="min-h-screen bg-black">
      <div className="container mx-auto px-4 pt-28 pb-16">
        <div className="mx-auto mb-8 w-fit rounded-full bg-[#2A2A2A] px-4 py-2 text-sm text-[#FF6B6B]">
          Instructor spotlight
        </div>

        <h1 className="mb-12 text-center text-4xl font-bold text-white md:text-6xl">
          Learn with proven instructors
        </h1>

        <div className="flex flex-col items-center justify-between gap-12 md:flex-row">
          <div className="max-w-xl">
            <blockquote className="mb-6 text-lg text-gray-300">
              Build practical skills through structured lessons, guided projects, and direct support.
            </blockquote>

            <p className="mb-6 text-gray-400">
              Every course is organized into modules with clear outcomes, so students know exactly what to do next.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/courses" className="rounded-md bg-[#FF6B6B] px-5 py-2 text-white hover:bg-[#FF5252]">
                Browse Courses
              </Link>
              <Link href="/educator/register" className="rounded-md border border-gray-600 px-5 py-2 text-gray-200 hover:border-gray-500">
                Become an Educator
              </Link>
            </div>

            <div className="mt-8 max-w-md rounded-xl bg-[#1A1A1A] p-4">
              <div className="flex items-center gap-4">
                <Image
                  src="/instructor-profile.jpg"
                  alt="Featured instructor"
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full object-cover"
                />
                <div>
                  <h3 className="font-semibold text-white">Featured Instructor</h3>
                  <p className="text-sm text-gray-400">Mentoring students across coding and system design tracks</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative w-full max-w-[500px]">
            <div className="relative mx-auto h-[320px] w-[320px] overflow-hidden rounded-full border-4 border-[#FF6B6B]/50 bg-[#FF6B6B]/20 md:h-[460px] md:w-[460px]">
              <Image
                src="/instructor-profile.jpg"
                alt="Instructor profile"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 320px, 460px"
              />
            </div>

            <div className="absolute bottom-0 left-1/2 w-[92%] -translate-x-1/2 rounded-xl bg-[#1A1A1A] px-4 py-4 md:w-auto md:px-6">
              <p className="mb-3 text-center text-sm text-gray-400">Learners from companies like</p>
              <div className="flex items-center justify-center gap-4 md:gap-6">
                <Image src="/companies/google.svg" alt="Google" width={72} height={22} />
                <Image src="/companies/amazon.svg" alt="Amazon" width={72} height={22} />
                <Image src="/companies/meta.svg" alt="Meta" width={72} height={22} />
                <Image src="/companies/microsoft.svg" alt="Microsoft" width={72} height={22} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
