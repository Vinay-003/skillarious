'use client';
import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import Link from 'next/link';
import FAQ from '@/components/FAQ';
import AnimatedTestimonials from '@/components/AnimatedTestimonials';
import { useAuth } from '@/context/AuthContext';
import { useRef } from "react";

interface Learner {
  name: string;
  company: string;
  image: string;
  companyLogo: string;
}

interface Resource {
  title: string;
  description: string;
  icon: string;
  color: string;
  link: string;
}

interface SocialStat {
  platform: string;
  followers: string;
  icon: string;
  color: string;
  link: string;
}

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Software Engineer",
    text: "The course content is incredibly well-structured and practical. I've learned so much!",
    avatar: "/testimonials/avatar1.jpg"
  },
  {
    name: "Michael Chen",
    role: "Data Scientist",
    text: "The hands-on projects really helped me understand complex concepts better.",
    avatar: "/testimonials/avatar2.jpg"
  },
  {
    name: "Emily Rodriguez",
    role: "Web Developer",
    text: "Great community and support. The instructors are very responsive.",
    avatar: "/testimonials/avatar3.jpg"
  },
  {
    name: "David Kim",
    role: "Student",
    text: "Perfect for beginners! The pace is just right and explanations are clear.",
    avatar: "/testimonials/avatar1.jpg"
  }
];

const coderShineData = [
  {
    title: "DSA",
    description: "Master Data Structures & Algorithms",
    icon: "📊"
  },
  {
    title: "Development",
    description: "Learn Full Stack Development",
    icon: "💻"
  },
  {
    title: "System Design",
    description: "Master System Design Concepts",
    icon: "🔧"
  },
  // Add more categories as needed
];

const LearnerAvatar = ({ name, image }: { name: string; image: string }) => (
  <div className="flex items-center gap-6 bg-[#1E1E1E] rounded-full px-8 py-4">
    <div className="relative w-24 h-24">
      <Image
        src={image}
        alt={name}
        fill
        sizes="96px"
        className="rounded-full object-cover"
      />
      <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-green-500 rounded-full border-3 border-[#1E1E1E]" />
    </div>
    <span className="text-white text-2xl font-medium">{name}</span>
  </div>
);

const FloatingLearners = () => {
  const learners = [
    { name: "Prajwal Shah", image: "/testimonials/avatar1.jpg" },
    { name: "K Sanketh Kumar", image: "/testimonials/avatar2.jpg" },
    { name: "Sankalp Jain", image: "/testimonials/avatar3.jpg" },
    { name: "Anubhuti Pandey", image: "/instructor-profile.jpg" },
    { name: "Sudipta B", image: "/testimonials/avatar2.jpg" },
  ];

  return (
    <div className="relative w-full overflow-hidden py-12">
      <div className="flex gap-12 learner-scroll">
        <motion.div
          className="flex gap-12 animate-scroll"
          animate={{
            x: ["0%", "-50%"]
          }}
          transition={{
            duration: 20,
            ease: "linear",
            repeat: Infinity,
          }}
        >
          {[...learners, ...learners].map((learner, index) => (
            <LearnerAvatar
              key={`${learner.name}-${index}`}
              name={learner.name}
              image={learner.image}
            />
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default function HomePage() {
  const [statsRef, statsInView] = useInView({
    triggerOnce: true,
    threshold: 0.2,
  });

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const staggerChildren = {
    visible: {
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const countAnimation = {
    hidden: { opacity: 0, scale: 0.5 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: {
        duration: 0.8,
        ease: "easeOut"
      }
    }
  };

  const learners: Learner[] = [
    {
      name: 'Prajwal Shah',
      company: 'Deutsche Bank',
      image: '/testimonials/avatar1.jpg',
      companyLogo: '/companies/deutsche-bank.svg'
    },
    {
      name: 'K Sanketh Kumar',
      company: 'EA Sports',
      image: '/testimonials/avatar2.jpg',
      companyLogo: '/companies/ea.svg'
    },
    {
      name: 'Sankalp Jain',
      company: 'Samsung',
      image: '/testimonials/avatar3.jpg',
      companyLogo: '/companies/samsung.svg'
    },
    {
      name: 'Anubhuti Pandey',
      company: 'Google',
      image: '/instructor-profile.jpg',
      companyLogo: '/companies/google.svg'
    },
    {
      name: 'Sudipta B',
      company: 'Amazon',
      image: '/testimonials/avatar2.jpg',
      companyLogo: '/companies/amazon.svg'
    },
  ];

  const resources: Resource[] = [
    {
      title: "Striver's DSA Sheet",
      description: "Boost your DSA skills with our handy cheat sheets",
      icon: "📄",
      color: "bg-[#FF8A65]",
      link: "/resources/dsa-sheet"
    },
    {
      title: "Technical Blogs",
      description: "Explore Tech Innovation with Engaging Blogs",
      icon: "📝",
      color: "bg-[#4FC3F7]",
      link: "/resources/blogs"
    },
    {
      title: "Striver's CP Sheet",
      description: "Level Up Your Coding with Practice Resources",
      icon: "📝",
      color: "bg-[#4DB6AC]",
      link: "/resources/cp-sheet"
    },
    {
      title: "System Design",
      description: "Master the Art of System Architecture",
      icon: "💻",
      color: "bg-[#EF5350]",
      link: "/resources/system-design"
    },
    {
      title: "CS Subjects",
      description: "Core Computer Science Fundamentals",
      icon: "🖥️",
      color: "bg-[#AB47BC]",
      link: "/resources/cs-subjects"
    },
    {
      title: "Interview Experience",
      description: "Learn from Real Interview Stories",
      icon: "👥",
      color: "bg-[#FFA726]",
      link: "/resources/interview-exp"
    }
  ];

  const socialStats: SocialStat[] = [
    {
      platform: 'Youtube',
      followers: '800K+',
      icon: '/icons/youtube.svg',
      color: 'text-red-500',
      link: 'https://youtube.com/takeUforward'
    },
    {
      platform: 'Twitter',
      followers: '160K+',
      icon: '/icons/twitter.svg',
      color: 'text-blue-400',
      link: 'https://twitter.com/takeUforward'
    },
    {
      platform: 'Instagram',
      followers: '210K+',
      icon: '/icons/instagram.svg',
      color: 'text-pink-500',
      link: 'https://instagram.com/takeUforward'
    },
    {
      platform: 'LinkedIn',
      followers: '750K+',
      icon: '/icons/linkedin.svg',
      color: 'text-blue-600',
      link: 'https://linkedin.com/company/takeUforward'
    }
  ];

  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  // Smooth spring animation for scroll progress
  const smoothProgress = useSpring(scrollYProgress, {
    damping: 15,
    stiffness: 30
  });

  const { user, loading } = useAuth();

  useEffect(() => {
    console.log('Current User:', user);
  }, [user]);

  return (
    <main className="min-h-screen bg-black">
      {/* Hero Section */}
      <section className="pt-32 pb-8 relative">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={staggerChildren}
          className="container mx-auto px-4 text-center"
        >
          <motion.h1 
            variants={fadeInUp}
            className="text-4xl md:text-6xl font-bold text-white mb-6"
          >
            Advance Your Career with{' '}
            <motion.span
              initial={{ color: '#fff' }}
              animate={{ color: '#FF6B6B' }}
              transition={{ duration: 1, delay: 0.5 }}
            >
              Learn Sphere
            </motion.span>
          </motion.h1>

          <motion.h2 
            variants={fadeInUp}
            className="text-2xl md:text-3xl font-bold text-white mb-4"
          >
            Your{' '}
            <motion.span
              initial={{ scale: 1 }}
              animate={{ scale: 1.1 }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
              className="bg-[#1E1E1E] px-3 py-1 rounded inline-block"
            >
              Ultimate
            </motion.span>
            {' '} Hub for Smarter Learning
          </motion.h2>

          <motion.p 
            variants={fadeInUp}
            className="text-gray-400 max-w-2xl mx-auto mb-8"
          >
            Discover top-tier courses created by expert educators across diverse fields. Whether you're upgrading skills or exploring a new passion, Learn Sphere empowers your journey with flexible learning options.
          </motion.p>

          <motion.div 
            variants={fadeInUp}
            className="flex justify-center gap-4"
          >
            {!user && !loading && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-[#1E1E1E] text-white px-6 py-3 rounded-lg hover:bg-[#2D2D2D] transition-colors"
              >
              <Link href="/login" >
                Join Now
              </Link>
              </motion.button>
            )
            }
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-[#FF6B6B] text-white px-6 py-3 rounded-lg hover:bg-[#FF5252] transition-colors"
            >
              <Link href="/courses" >
                Explore Courses
              </Link>
            </motion.button>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <motion.section
        ref={statsRef}
        initial="hidden"
        animate={statsInView ? "visible" : "hidden"}
        variants={staggerChildren}
        className="py-16"
      >
        <div className="container mx-auto px-4">
          <motion.div 
            variants={fadeInUp}
            className="bg-[#1E1E1E] rounded-xl p-8"
          >
            <FloatingLearners />
          </motion.div>
        </div>
      </motion.section>

      {/* Resources to Learn Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-white text-center mb-12">
            Resources to Learn
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {resources.map((resource, index) => (
              <Link 
                href={resource.link}
                key={index}
                className={`${resource.color} rounded-xl p-6 transition-transform hover:scale-105`}
              >
                <div className="bg-white/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                  <span className="text-2xl">{resource.icon}</span>
                </div>
                <h3 className="text-white text-xl font-semibold mb-2">
                  {resource.title}
                </h3>
                <p className="text-white/80 text-sm">
                  {resource.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Social Stats Section */}
      <section className="py-16 bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-white text-center mb-16">
            Join Our Ever-Growing Global Community
          </h2>
          
          <div className="flex flex-wrap justify-center gap-8">
            {socialStats.map((stat, index) => (
              <Link 
                href={stat.link}
                key={index}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <div className="relative w-48 h-48 bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-6 flex flex-col items-center justify-center transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                  <div className="absolute -top-2 -left-2 w-full h-full bg-gray-700/20 rounded-3xl transform -rotate-6 group-hover:rotate-0 transition-transform"></div>
                  <div className="relative z-10 text-center">
                    <h3 className="text-4xl font-bold text-white mb-2">
                      {stat.followers}
                    </h3>
                    <div className="flex items-center justify-center gap-2">
                      <Image 
                        src={stat.icon} 
                        alt={stat.platform} 
                        width={24} 
                        height={24}
                        className={stat.color}
                      />
                      <span className="text-gray-300">{stat.platform}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Coder Shine Section */}
      <section className="py-24 bg-gradient-to-b from-gray-900 to-black">
        <div className="max-w-7xl mx-auto px-4">
          {/* Floating Title */}
          <div className="relative mb-24 text-center">
            <div className="absolute left-1/2 -top-12 w-px h-12 bg-gradient-to-b from-transparent to-[#FF6B47]" />
            <motion.div 
              className="text-4xl font-bold"
              animate={{
                rotate: [-2, 2, -2],
                y: [0, -5, 0]
              }}
              transition={{
                rotate: {
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                },
                y: {
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}
              style={{
                transformOrigin: "top center"
              }}
            >
              <span className="text-white">Where </span>
              <motion.span 
                className="text-[#FF6B47] inline-block relative"
                animate={{
                  y: [0, -8, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.5
                }}
              >
                Coders
                <span className="absolute bottom-0 left-0 w-full h-1 bg-[#FF6B47] rounded-full"></span>
              </motion.span>
              <span className="text-white"> Shine</span>
            </motion.div>
          </div>

          {/* Coder Shine Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {coderShineData.map((item, index) => (
              <motion.div
                key={index}
                className="bg-[#1A1A1A] rounded-xl p-8 text-center hover:bg-[#2A2A2A] transition-colors"
                whileHover={{ scale: 1.05 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.2 }}
              >
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Enhanced Testimonials Section */}
      <section ref={containerRef} className="py-32 bg-gray-900 relative overflow-hidden">
        {/* Floating Title with orange accent */}
        <div className="relative mb-20 text-center">
          <div className="absolute left-1/2 -top-12 w-px h-12 bg-gradient-to-b from-transparent to-[#FF6B47]" />
          <motion.div 
            className="text-5xl font-bold text-center"
            animate={{
              rotate: [-2, 2, -2],
              y: [0, -5, 0]
            }}
            transition={{
              rotate: {
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              },
              y: {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }
            }}
            style={{
              transformOrigin: "top center"
            }}
          >
            <span className="text-white">What Users </span>
            <motion.span 
              className="text-[#FF6B47] inline-block relative"
              animate={{
                y: [0, -8, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5
              }}
            >
              Say
              <span className="absolute bottom-0 left-0 w-full h-1 bg-[#FF6B47] rounded-full"></span>
            </motion.span>
          </motion.div>
        </div>

        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {/* Left Column - Scrolls Up */}
            <div className="space-y-8">
              {testimonials.filter((_, i) => i % 2 === 0).map((testimonial, index) => (
                <motion.div
                  key={index}
                  className="bg-[#1A1A1A] rounded-xl p-8 hover:bg-[#2A2A2A] transition-all duration-300"
                  style={{
                    y: useTransform(
                      smoothProgress,
                      [0, 1],
                      [0, index % 2 === 0 ? -20 : 20]
                    ),
                    x: useTransform(
                      smoothProgress,
                      [0, 1],
                      [0, index % 2 === 0 ? -20 : 20]
                    )
                  }}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: false, margin: "-100px" }}
                  whileHover={{ scale: 1.02, rotate: -1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      className="w-12 h-12 rounded-full border-2 border-[#FF6B47]"
                    />
                    <div>
                      <h4 className="text-white font-semibold">{testimonial.name}</h4>
                      <p className="text-[#FF6B47]">{testimonial.role}</p>
                      <p className="text-gray-300 mt-4">{testimonial.text}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Right Column - Scrolls Down */}
            <div className="space-y-8 mt-12 md:mt-24">
              {testimonials.filter((_, i) => i % 2 === 1).map((testimonial, index) => (
                <motion.div
                  key={index}
                  className="bg-[#1A1A1A] rounded-xl p-8 hover:bg-[#2A2A2A] transition-all duration-300"
                  style={{
                    y: useTransform(
                      smoothProgress,
                      [0, 1],
                      [0, 100 * (index + 1)]
                    ),
                    x: useTransform(
                      smoothProgress,
                      [0, 1],
                      [0, index % 2 === 0 ? 20 : -20]
                    )
                  }}
                  initial={{ opacity: 0, y: -50 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: false, margin: "-100px" }}
                  whileHover={{ scale: 1.02, rotate: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      className="w-12 h-12 rounded-full border-2 border-[#FF6B47]"
                    />
                    <div>
                      <h4 className="text-white font-semibold">{testimonial.name}</h4>
                      <p className="text-[#FF6B47]">{testimonial.role}</p>
                      <p className="text-gray-300 mt-4">{testimonial.text}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating particles */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
        >
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-[#FF6B47] rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -100, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: Math.random() * 3 + 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </motion.div>
      </section>

      {/* FAQ Section */}
      <FAQ />

      {/* Floating Elements */}
      <motion.div
        animate={{
          y: [0, -20, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          repeatType: "reverse",
        }}
        className="absolute top-40 left-20 w-8 h-8 bg-[#FF6B6B] rounded-full opacity-20"
      />
      <motion.div
        animate={{
          y: [0, 20, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          repeatType: "reverse",
        }}
        className="absolute top-60 right-40 w-6 h-6 bg-blue-500 rounded-full opacity-20"
      />
    </main>
  );
}

// Testimonial Card Component
// const TestimonialCard = ({ testimonial }) => {
//   return (
//     <motion.div 
//       className="bg-[#1A1A1A] rounded-lg p-6 text-white hover:bg-[#2A2A2A] transition-colors"
//       whileHover={{ scale: 1.02 }}
//       transition={{ duration: 0.2 }}
//     >
//       <div className="flex items-start gap-4">
//         <div className="w-12 h-12 rounded-full bg-[#2A2A2A] flex items-center justify-center">
//           <span className="text-sm font-medium">{testimonial.userInitial}</span>
//         </div>
//         <div className="flex-1">
//           <div className="flex justify-between items-center mb-2">
//             <h3 className="font-semibold">{testimonial.userName}</h3>
//             {testimonial.social === 'linkedin' && (
//               <svg className="w-5 h-5 text-[#FF6B47]" viewBox="0 0 24 24" fill="currentColor">
//                 <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
//               </svg>
//             )}
//           </div>
//           <p className="text-gray-400 text-sm">{testimonial.handle}</p>
//           <p className="mt-3 text-gray-200">{testimonial.message}</p>
//         </div>
//       </div>
//     </motion.div>
//   );
// };















