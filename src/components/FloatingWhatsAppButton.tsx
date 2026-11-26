import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, MessageSquare, PackageCheck, Store, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BRAND_INFO } from '../data/catalog.ts';
import { trackAnalyticsEvent } from '../lib/api.ts';

interface FloatingWhatsAppButtonProps {
  hidden?: boolean;
}

interface QuickTopic {
  id: string;
  title: string;
  subtitle: string;
  trackingLabel: string;
  message: string;
  icon: typeof PackageCheck;
}

const QUICK_TOPICS: QuickTopic[] = [
  {
    id: 'order',
    title: 'Pesan Langsung via Chat',
    subtitle: 'Bantu pilih paket 3, 6, atau 15 pouch',
    trackingLabel: 'Floating WhatsApp — Pesan Langsung',
    message:
      'Halo Umi Hana, saya ingin memesan Kripik Tempe Rasa Original (60 g) langsung via WhatsApp. Mohon dibantu info paket & pengirimannya.',
    icon: PackageCheck,
  },
  {
    id: 'consult',
    title: 'Konsultasi Produk & Ongkir',
    subtitle: 'Tanya komposisi, masa simpan, & estimasi tiba',
    trackingLabel: 'Floating WhatsApp — Konsultasi Produk',
    message:
      'Halo Umi Hana, saya ingin konsultasi seputar Kripik Tempe Rasa Original dan estimasi ongkir ke kota saya.',
    icon: MessageSquare,
  },
  {
    id: 'reseller',
    title: 'Tanya Harga Reseller / Kantor',
    subtitle: 'Stok pantry, hampers, atau jual kembali',
    trackingLabel: 'Floating WhatsApp — Info Reseller',
    message:
      'Halo Umi Hana, saya tertarik dengan Paket Kantor & Reseller (15 pouch / grosir). Bisa dibantu daftar harganya?',
    icon: Store,
  },
];

function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${BRAND_INFO.whatsappNormalized}?text=${encodeURIComponent(message)}`;
}

function WhatsAppBrandIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className ?? 'w-6 h-6'}
    >
      <path d="M20.52 3.48A11.82 11.82 0 0 0 12.06 0C5.5 0 .16 5.33.16 11.9c0 2.1.55 4.15 1.59 5.95L0 24l6.33-1.66a11.86 11.86 0 0 0 5.73 1.46h.01c6.55 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.45-8.42ZM12.07 21.8h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.76.98 1-3.66-.24-.38a9.84 9.84 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.13 1.03 7 2.9a9.83 9.83 0 0 1 2.9 7c0 5.46-4.44 9.9-9.89 9.9Zm5.42-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.08-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.21 5.09 4.5.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35Z" />
    </svg>
  );
}

export function FloatingWhatsAppButton({ hidden = false }: FloatingWhatsAppButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (hidden) {
      setOpen(false);
    }
  }, [hidden]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  if (hidden || typeof document === 'undefined') return null;

  const directChatUrl = buildWhatsAppUrl(
    'Halo Umi Hana, saya ingin bertanya atau memesan Kripik Tempe Rasa Original (60 g).'
  );

  const handleToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      void trackAnalyticsEvent('whatsapp_click', 'Floating WhatsApp — Buka Menu Chat');
    }
  };

  const handleTrackTopic = (label: string) => {
    void trackAnalyticsEvent('whatsapp_click', label);
    setOpen(false);
  };

  const content = (
    <div
      ref={containerRef}
      className="fixed bottom-[max(1rem,calc(env(safe-area-inset-bottom)+0.75rem))] right-4 sm:bottom-6 sm:right-6 z-[60] flex flex-col items-end"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            id="umi-floating-wa-panel"
            role="dialog"
            aria-label="Konsultasi & Pesan via WhatsApp Umi Hana"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mb-3 w-[min(calc(100vw-2rem),340px)] bg-white rounded-2xl border border-[#DCE8D5] shadow-[0_20px_48px_rgba(20,42,24,0.18)] overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#1B6B3A] text-white px-4 py-3.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-base font-bold leading-snug">
                  Chat Admin Umi Hana
                </div>
                <p className="text-xs text-[#E1F3E5] mt-0.5 leading-relaxed">
                  Konsultasi produk atau pesan cepat langsung via WhatsApp resmi ({BRAND_INFO.whatsappDisplay}).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup panel WhatsApp"
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Topics */}
            <div className="p-3.5 space-y-2 bg-[#FCFDF9]">
              <p className="px-1 text-xs font-medium text-[#525C53]">
                Pilih topik untuk langsung terhubung ke chat:
              </p>

              <div className="space-y-1.5">
                {QUICK_TOPICS.map((topic) => {
                  const Icon = topic.icon;
                  return (
                    <a
                      key={topic.id}
                      href={buildWhatsAppUrl(topic.message)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleTrackTopic(topic.trackingLabel)}
                      className="group flex items-start justify-between gap-3 p-3 rounded-xl bg-white border border-[#E4E7DF] hover:border-[#249A48] hover:bg-[#F3FAF4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B6B3A]"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 text-[#1B6B3A] mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-semibold text-[#141A15] group-hover:text-[#14532D] transition-colors">
                            {topic.title}
                          </div>
                          <div className="text-xs text-[#525C53] mt-0.5 leading-snug">
                            {topic.subtitle}
                          </div>
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-[#6B7A6D] group-hover:text-[#1B6B3A] shrink-0 mt-0.5 transition-colors" />
                    </a>
                  );
                })}
              </div>

              <div className="pt-1.5">
                <a
                  href={directChatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleTrackTopic('Floating WhatsApp — Mulai Chat Langsung')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#1D8F44] hover:bg-[#167336] rounded-xl transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B6B3A] focus-visible:ring-offset-2"
                >
                  <WhatsAppBrandIcon className="w-4 h-4 shrink-0" />
                  Mulai Chat Sekarang
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Floating Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-controls="umi-floating-wa-panel"
        aria-label={open ? 'Tutup menu WhatsApp Umi Hana' : 'Chat atau pesan via WhatsApp Umi Hana'}
        className="group inline-flex items-center justify-center gap-2.5 h-13 w-13 sm:h-14 sm:w-auto sm:px-5 rounded-full bg-[#1D8F44] hover:bg-[#167336] active:scale-[0.98] text-white shadow-[0_12px_28px_rgba(22,115,54,0.38)] border-2 border-white/80 transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B6B3A] focus-visible:ring-offset-2"
      >
        {open ? (
          <X className="w-6 h-6 shrink-0" />
        ) : (
          <WhatsAppBrandIcon className="w-6 h-6 shrink-0 transition-transform duration-150 group-hover:scale-105" />
        )}
        <span className="hidden sm:inline text-sm font-semibold whitespace-nowrap shrink-0">
          {open ? 'Tutup Chat' : 'Chat WhatsApp'}
        </span>
      </button>
    </div>
  );

  return createPortal(content, document.body);
}
