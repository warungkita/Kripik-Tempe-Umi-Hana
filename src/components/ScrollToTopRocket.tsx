import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Rocket } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

interface ScrollToTopRocketProps {
  hidden?: boolean;
}

function getCurrentScrollTop(): number {
  if (typeof window === 'undefined') return 0;
  return (
    window.scrollY ||
    window.pageYOffset ||
    document.documentElement?.scrollTop ||
    document.body?.scrollTop ||
    0
  );
}

export function ScrollToTopRocket({ hidden = false }: ScrollToTopRocketProps) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [launching, setLaunching] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = getCurrentScrollTop() > 160;
      setHasScrolled(scrolled);
      if (!scrolled) {
        setLaunching(false);
      }
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  if (typeof document === 'undefined') return null;

  const handleScrollUp = () => {
    if (!prefersReducedMotion) {
      setLaunching(true);
      window.setTimeout(() => setLaunching(false), 500);
    }
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
    window.scrollTo({ top: 0, behavior });
    document.documentElement?.scrollTo({ top: 0, behavior });
    document.body?.scrollTo({ top: 0, behavior });
  };

  return createPortal(
    <AnimatePresence>
      {hasScrolled && !hidden && (
        <motion.button
          type="button"
          onClick={handleScrollUp}
          aria-label="Kembali ke atas halaman"
          title="Kembali ke atas"
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.9 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="group fixed bottom-[max(1rem,calc(env(safe-area-inset-bottom)+0.75rem))] left-4 sm:bottom-6 sm:left-6 z-[60] inline-flex items-center justify-center w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-[#FACC15] hover:bg-[#EAB308] text-[#1B2E12] border-2 border-white shadow-[0_12px_26px_rgba(20,42,24,0.22)] transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A28] focus-visible:ring-offset-2"
        >
          <motion.span
            animate={
              launching && !prefersReducedMotion
                ? { y: [0, -7, 0], scale: [1, 1.14, 1] }
                : { y: 0, scale: 1 }
            }
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center justify-center transition-transform duration-150 group-hover:-translate-y-0.5"
          >
            <Rocket className="w-5 h-5 -rotate-45" aria-hidden="true" />
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>,
    document.body
  );
}
