"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { TextSlideUp } from "@/components/ui/text-slide-up";

const QUOTES = [
  { text: "Dream big. Start small. Act now.", author: "Robin Sharma" },
  {
    text: "A journey of a thousand miles begins with a single step.",
    author: "Lao Tzu",
  },
  { text: "Failure is the key to success.", author: "Japanese proverb" },
  { text: "Small aim is a crime.", author: "A. P. J. Abdul Kalam" },
  {
    text: "When learning is purposeful, creativity blossoms.",
    author: "A. P. J. Abdul Kalam",
  },
  { text: "The doer alone learns.", author: "Bruce Lee" },
  {
    text: "You just keep climbing patiently, one step at a time.",
    author: "Akira Kurosawa",
  },
  {
    text: "Efforts will lie, but they will not be in vain.",
    author: "Yuzuru Hanyu",
  },
] as const;

const ROTATE_MS = 7000;

export function QuoteRotator() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      // Skip while the tab is hidden so the user never returns mid-sequence.
      if (document.visibilityState !== "visible") return;
      setIndex((current) => (current + 1) % QUOTES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [paused]);

  const quote = QUOTES[index];

  return (
    // reducedMotion="user" drops the slide transforms but keeps the fades.
    <MotionConfig reducedMotion="user">
      <figure
        className="flex h-60 w-full flex-col items-center justify-start text-center"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeIn" }}
            className="flex flex-col items-center"
          >
            <blockquote>
              <span className="sr-only">{quote.text}</span>
              <TextSlideUp
                aria-hidden="true"
                by="word"
                duration={0.6}
                staggerDelay={0.06}
                distance={18}
                className="text-[44px] font-normal leading-[1.22] tracking-[-0.015em] text-[#0b2152] text-balance xl:text-[48px]"
              >
                {quote.text}
              </TextSlideUp>
            </blockquote>
            <motion.figcaption
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.5,
                delay: 0.3 + quote.text.split(" ").length * 0.06,
              }}
              className="mt-7 text-[13px] font-extrabold uppercase tracking-[0.2em] text-[#4a6aa5]"
            >
              {quote.author}
            </motion.figcaption>
          </motion.div>
        </AnimatePresence>
      </figure>
    </MotionConfig>
  );
}
