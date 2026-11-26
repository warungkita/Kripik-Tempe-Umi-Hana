import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Testimonial } from '../types.ts';

interface TestimonialSliderProps {
  testimonials: Testimonial[];
}

function CustomerAvatar({
  src,
  name,
  size = 'lg',
}: {
  src: string;
  name: string;
  size?: 'sm' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('');

  const dimensionClass =
    size === 'lg'
      ? 'w-20 h-20 sm:w-24 sm:h-24 rounded-2xl text-xl'
      : 'w-10 h-10 rounded-full text-xs';

  if (failed || !src) {
    return (
      <div
        aria-hidden="true"
        className={`${dimensionClass} bg-gradient-to-br from-[#229834] to-[#135E20] text-[#FDE047] font-display font-bold flex items-center justify-center shrink-0`}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Foto pelanggan ${name}`}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${dimensionClass} object-cover shrink-0 border-2 border-[#EAE0C1] bg-[#F5F2E4]`}
    />
  );
}

export function TestimonialSlider({ testimonials }: TestimonialSliderProps) {
  const prefersReducedMotion = useReducedMotion();
  const [segmentFilter, setSegmentFilter] = useState<'Semua' | Testimonial['segment']>('Semua');
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);

  const filtered =
    segmentFilter === 'Semua'
      ? testimonials
      : testimonials.filter((item) => item.segment === segmentFilter);

  const total = filtered.length;
  const safeIndex = total > 0 ? activeIndex % total : 0;
  const current = filtered[safeIndex];

  const handleSegmentChange = (seg: 'Semua' | Testimonial['segment']) => {
    setSegmentFilter(seg);
    setActiveIndex(0);
    setDirection(1);
  };

  const goNext = useCallback(() => {
    if (total <= 1) return;
    setDirection(1);
    setActiveIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    setDirection(-1);
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const goToIndex = (targetIdx: number) => {
    if (targetIdx === safeIndex || total <= 1) return;
    setDirection(targetIdx > safeIndex ? 1 : -1);
    setActiveIndex(targetIdx);
  };

  // Gentle auto-advance that pauses on hover, focus, or reduced-motion preference
  useEffect(() => {
    if (paused || prefersReducedMotion || total <= 1) return;
    const timer = window.setInterval(goNext, 6500);
    return () => window.clearInterval(timer);
  }, [paused, prefersReducedMotion, total, goNext]);

  if (!current) return null;

  const slideVariants = {
    enter: (dir: number) =>
      prefersReducedMotion
        ? { opacity: 0 }
        : { opacity: 0, x: dir > 0 ? 36 : -36 },
    center: { opacity: 1, x: 0 },
    exit: (dir: number) =>
      prefersReducedMotion
        ? { opacity: 0 }
        : { opacity: 0, x: dir > 0 ? -36 : 36 },
  };

  return (
    <section id="testimoni" className="bg-[#FAF5E4]/80 border-y border-[#ECE2C3] py-16 lg:py-20">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        {/* Section Header + Category Filter */}
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <span className="w-12 h-1.5 rounded-full bg-[#229834]" aria-hidden="true" />
            <h2 className="font-display italic font-extrabold text-3xl sm:text-4xl text-[#135E20] tracking-tight">
              Testimoni Pelanggan
            </h2>
            <span className="w-12 h-1.5 rounded-full bg-[#FACC15]" aria-hidden="true" />
          </div>

          <p className="text-sm sm:text-base text-[#4B5847]">
            Cerita asli keluarga, kantor, dan mitra reseller yang rutin menikmati Kripik Tempe Umi Hana.
          </p>

          {/* Interactive Segmented Filter Control */}
          <div
            role="tablist"
            aria-label="Filter kategori testimoni"
            className="inline-flex flex-wrap items-center justify-center gap-1 p-1 bg-white border border-[#EAE0C1] rounded-full shadow-xs"
          >
            {(['Semua', 'Keluarga', 'Kantor & Hampers', 'Reseller'] as const).map((seg) => (
              <button
                key={seg}
                type="button"
                role="tab"
                aria-selected={segmentFilter === seg}
                onClick={() => handleSegmentChange(seg)}
                className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  segmentFilter === seg
                    ? 'bg-[#177A28] text-white'
                    : 'text-[#4B5847] hover:text-[#135E20]'
                }`}
              >
                {seg}
              </button>
            ))}
          </div>
        </div>

        {/* Main Interactive Testimonial Slider */}
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="Slider ulasan pelanggan Umi Hana"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
          className="max-w-4xl mx-auto space-y-6"
        >
          <div className="relative">
            <div className="overflow-hidden rounded-3xl bg-[#FFFDF5] border border-[#EAE0C1] shadow-[0_12px_32px_rgba(74,37,17,0.07)]">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.article
                  key={current.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  drag={total > 1 ? 'x' : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.18}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -55) {
                      goNext();
                    } else if (info.offset.x > 55) {
                      goPrev();
                    }
                  }}
                  className="p-6 sm:p-10 cursor-grab active:cursor-grabbing"
                >
                  <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
                    {/* Customer Portrait Photo */}
                    <div className="flex sm:flex-col items-center sm:items-start gap-4 sm:gap-3 shrink-0">
                      <CustomerAvatar src={current.avatar} name={current.name} size="lg" />
                      <div className="sm:hidden">
                        <div className="font-display text-lg font-bold text-[#141A15] leading-snug">
                          {current.name}
                        </div>
                        <div className="text-xs text-[#525C53] mt-0.5">
                          {current.role} · {current.city}
                        </div>
                      </div>
                    </div>

                    {/* Review Body & Metadata */}
                    <div className="flex-1 min-w-0 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex items-center gap-0.5 text-[#F59E0B]"
                            aria-label="Rating 5 dari 5 bintang"
                          >
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className="w-4 h-4 fill-current" />
                            ))}
                          </div>
                          <span className="text-xs font-mono-tabular font-semibold text-[#141A15]">
                            5,0
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#6B7466]">
                          <span>{current.packageBought}</span>
                          <span aria-hidden="true">·</span>
                          <span>{current.verifiedDate}</span>
                        </div>
                      </div>

                      <div className="relative">
                        <Quote
                          className="w-6 h-6 text-[#D8E7D1] mb-2"
                          aria-hidden="true"
                        />
                        <blockquote className="text-base sm:text-lg text-[#1C2A1A] leading-relaxed font-medium">
                          &ldquo;{current.quote}&rdquo;
                        </blockquote>
                      </div>

                      <div className="pt-4 border-t border-[#EFE7CE] flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                        <div className="hidden sm:block">
                          <div className="font-display text-lg font-bold text-[#141A15]">
                            {current.name}
                          </div>
                          <div className="text-xs text-[#525C53] mt-0.5">
                            {current.role} · {current.city}
                          </div>
                        </div>

                        <div className="text-xs sm:text-sm font-bold text-[#157A28] sm:text-right">
                          {current.outcome}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.article>
              </AnimatePresence>
            </div>
          </div>

          {/* Slider Navigation Bar: Prev/Next + Counter + Customer Thumbnail Selectors */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Customer Photo Thumbnails (Clickable Direct Navigation) */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              {filtered.map((item, idx) => {
                const isActive = idx === safeIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goToIndex(idx)}
                    aria-label={`Lihat testimoni dari ${item.name}`}
                    aria-current={isActive ? 'true' : undefined}
                    className={`flex items-center gap-2.5 pl-1.5 pr-3.5 py-1.5 rounded-full border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A28] ${
                      isActive
                        ? 'bg-white border-[#177A28] shadow-xs'
                        : 'bg-[#FFFDF5]/70 border-[#EAE0C1] opacity-75 hover:opacity-100 hover:bg-white'
                    }`}
                  >
                    <CustomerAvatar src={item.avatar} name={item.name} size="sm" />
                    <div className="text-left hidden md:block">
                      <div className="text-xs font-bold text-[#141A15] leading-tight whitespace-nowrap">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-[#525C53] leading-tight whitespace-nowrap">
                        {item.city}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Prev / Next Controls + Tabular Index */}
            {total > 1 && (
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono-tabular text-xs font-semibold text-[#525C53]">
                  0{safeIndex + 1} / 0{total}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Testimoni sebelumnya"
                    className="w-11 h-11 rounded-full bg-white border border-[#DCD2B2] text-[#141A15] hover:border-[#177A28] hover:text-[#177A28] inline-flex items-center justify-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A28]"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Testimoni berikutnya"
                    className="w-11 h-11 rounded-full bg-[#177A28] hover:bg-[#11601E] text-white inline-flex items-center justify-center transition-colors shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A28] focus-visible:ring-offset-2"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
