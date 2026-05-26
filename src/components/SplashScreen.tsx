import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_NAME } from '@/constants/branding';

const LOADING_MESSAGES = [
  'Preparing your workspace…',
  'Warming up AI notes…',
  'Checking audio intelligence…',
  'Loading meeting context…',
  'Almost ready…',
];

const MESSAGE_INTERVAL_MS = 1400;
const WAVEFORM_BARS = 7;

/**
 * Checks whether the user has requested reduced motion at the OS level.
 * Used to disable pulsing, waveform, shimmer, and entrance animations.
 */
function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}

export default function SplashScreen() {
  const [messageIndex, setMessageIndex] = useState(0);
  const reduced = usePrefersReducedMotion();

  // Rotate loading messages
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, MESSAGE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div className="splash-backdrop">
      <motion.div
        className="splash-card"
        initial={reduced ? false : { opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Logo with glow */}
        <div className="splash-logo-wrap">
          {!reduced && <div className="splash-logo-glow" />}
          <motion.img
            src="app-icon.png"
            alt={APP_NAME}
            className="splash-logo"
            draggable={false}
            initial={reduced ? false : { opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {/* App name */}
        <motion.h1
          className="splash-title"
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.3 }}
        >
          {APP_NAME}
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="splash-subtitle"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.45 }}
        >
          AI-powered meeting notes
        </motion.p>

        {/* Waveform */}
        <motion.div
          className="splash-waveform"
          aria-hidden="true"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.55 }}
        >
          {Array.from({ length: WAVEFORM_BARS }).map((_, i) => (
            <div
              key={i}
              className={`splash-waveform-bar${reduced ? ' splash-waveform-bar--static' : ''}`}
              style={
                reduced
                  ? undefined
                  : { animationDelay: `${i * 0.12}s` }
              }
            />
          ))}
        </motion.div>

        {/* Loading message */}
        <div className="splash-message-container">
          <AnimatePresence mode="wait">
            <motion.span
              key={messageIndex}
              className="splash-message"
              initial={reduced ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
            >
              {LOADING_MESSAGES[messageIndex]}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Shimmer progress bar */}
        <motion.div
          className="splash-progress"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.65 }}
        >
          {!reduced && <div className="splash-progress-shimmer" />}
        </motion.div>
      </motion.div>
    </div>
  );
}
