'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { FollowerPointerCard } from './ui/following-pointer';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "What is takeUforward Premium?",
    answer: "takeUforward Premium is our comprehensive learning platform that provides structured courses, personalized mentorship, and exclusive content for DSA, development, and interview preparation. It includes video lectures, practice problems, mock interviews, and a supportive community."
  },
  {
    question: "How is the course content structured?",
    answer: "Our courses follow a carefully designed learning path starting from basics to advanced concepts. Each topic includes video lectures, hands-on coding exercises, assignments, and real interview problems. You can track your progress and practice at your own pace."
  },
  {
    question: "Do you provide placement assistance?",
    answer: "Yes, we provide comprehensive placement assistance including mock interviews, resume reviews, and interview preparation strategies. Our platform also includes company-specific preparation guides and regularly updated interview experiences."
  },
  {
    question: "Can I access the content on mobile devices?",
    answer: "Yes, our platform is fully responsive and accessible on all devices. You can learn, practice, and track your progress seamlessly across desktop, tablet, and mobile devices."
  },
  {
    question: "What makes takeUforward different?",
    answer: "We offer industry-relevant curriculum designed by experts, personalized learning paths, active community support, and regular updates based on current interview trends. Our focus is on practical implementation and real-world problem-solving."
  },
  {
    question: "Is there a refund policy?",
    answer: "Yes, we offer a 7-day no-questions-asked refund policy if you're not satisfied with our premium features. We believe in the quality of our content and want you to be completely confident in your investment."
  }
];

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="py-16 bg-[#0B1120]"> {/* Darker background to match screenshot */}
      <div className="max-w-4xl mx-auto px-4">
        {/* Floating Title with orange accent */}
        <div className="relative mb-16 text-center">
          <div className="absolute left-1/2 -top-12 w-px h-12 bg-gradient-to-b from-transparent to-[#FF6B47]" />
          <motion.div 
            className="text-3xl font-bold"
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
            <span className="text-white"></span>
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
              FAQs
              <span className="absolute bottom-0 left-0 w-full h-1 bg-[#FF6B47] rounded-full"></span>
            </motion.span>
          </motion.div>
        </div>
        
        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <FollowerPointerCard
                title={openIndex === index ? "Close" : "Open"}
              >
                <motion.div
                  className="bg-[#1A1A1A] rounded-xl overflow-hidden hover:bg-[#252525] transition-colors duration-200"
                  initial={false}
                >
                  <motion.button
                    className="w-full px-8 py-6 flex items-center justify-between text-left text-white"
                    onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  >
                    <span className="font-medium text-xl">{faq.question}</span>
                    <motion.div
                      animate={{ rotate: openIndex === index ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="w-6 h-6 text-gray-400" />
                    </motion.div>
                  </motion.button>

                  <AnimatePresence>
                    {openIndex === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="px-8 pb-6"
                      >
                        <p className="text-gray-300 text-lg leading-relaxed">{faq.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </FollowerPointerCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FAQ;


