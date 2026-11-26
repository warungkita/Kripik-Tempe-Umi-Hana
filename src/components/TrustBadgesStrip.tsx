import { motion, useReducedMotion } from 'motion/react';

function HalalEmblemSvg() {
  return (
    <svg viewBox="0 0 56 56" fill="none" aria-hidden="true" className="w-12 h-12 shrink-0">
      <path
        d="M28 4L35.2 8.2L43.5 8.5L47.8 15.8L52 23L49.5 31L52 39L47.8 46.2L43.5 47.5L35.2 47.8L28 52L20.8 47.8L12.5 47.5L8.2 46.2L4 39L6.5 31L4 23L8.2 15.8L12.5 8.5L20.8 8.2L28 4Z"
        fill="#EAF7E4"
        stroke="#177A28"
        strokeWidth="2"
      />
      <circle cx="28" cy="28" r="17" fill="#177A28" />
      <circle cx="28" cy="28" r="14" stroke="#FDE047" strokeWidth="1.2" strokeDasharray="2 2" />
      <text
        x="28"
        y="27"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="8.5"
        fontWeight="800"
        letterSpacing="0.8"
      >
        HALAL
      </text>
      <text
        x="28"
        y="35"
        textAnchor="middle"
        fill="#FDE047"
        fontSize="5.5"
        fontWeight="700"
        letterSpacing="0.4"
      >
        INDONESIA
      </text>
    </svg>
  );
}

function PirtEmblemSvg() {
  return (
    <svg viewBox="0 0 56 56" fill="none" aria-hidden="true" className="w-12 h-12 shrink-0">
      <path
        d="M28 5L47 12.5V27.2C47 38.8 38.8 47.6 28 51C17.2 47.6 9 38.8 9 27.2V12.5L28 5Z"
        fill="#EAF7E4"
        stroke="#177A28"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M28 9.5L42.8 15.3V26.8C42.8 36 36.4 43 28 46C19.6 43 13.2 36 13.2 26.8V15.3L28 9.5Z"
        fill="#177A28"
      />
      <path
        d="M21.5 23.5L25.5 27.5L34.5 18.5"
        stroke="#FDE047"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="28"
        y="38"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="8.5"
        fontWeight="800"
        letterSpacing="0.6"
      >
        P-IRT
      </text>
    </svg>
  );
}

function SoybeanEmblemSvg() {
  return (
    <svg viewBox="0 0 56 56" fill="none" aria-hidden="true" className="w-12 h-12 shrink-0">
      <circle cx="28" cy="28" r="23" fill="#FEF6C7" stroke="#D97706" strokeWidth="2" />
      <circle cx="28" cy="28" r="19" stroke="#177A28" strokeWidth="1.2" strokeDasharray="2.5 2.5" />
      {/* Leaf accent */}
      <path
        d="M27 25C28 17 34 13 41 13C40 20 35 25 27 25Z"
        fill="#1E8E30"
      />
      {/* Golden selected soybeans */}
      <ellipse cx="22" cy="27" rx="5.5" ry="4.2" transform="rotate(-18 22 27)" fill="#F59E0B" stroke="#B45309" strokeWidth="1.4" />
      <ellipse cx="33" cy="31" rx="5.5" ry="4.2" transform="rotate(14 33 31)" fill="#FACC15" stroke="#B45309" strokeWidth="1.4" />
      <ellipse cx="24" cy="36" rx="5.2" ry="4" transform="rotate(8 24 36)" fill="#FBBF24" stroke="#B45309" strokeWidth="1.4" />
      <text
        x="28"
        y="46.5"
        textAnchor="middle"
        fill="#135E20"
        fontSize="6.5"
        fontWeight="800"
        letterSpacing="0.4"
      >
        100% KEDELAI
      </text>
    </svg>
  );
}

function HygienicEmblemSvg() {
  return (
    <svg viewBox="0 0 56 56" fill="none" aria-hidden="true" className="w-12 h-12 shrink-0">
      <circle cx="28" cy="28" r="23" fill="#EAF7E4" stroke="#177A28" strokeWidth="2" />
      <circle cx="28" cy="28" r="17.5" fill="#FFFFFF" stroke="#177A28" strokeWidth="1.4" />
      <path
        d="M20 28.5L25.5 34L36.5 22.5"
        stroke="#177A28"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M28 12L29.6 15.2L33.2 15.7L30.6 18.2L31.2 21.8L28 20.1L24.8 21.8L25.4 18.2L22.8 15.7L26.4 15.2L28 12Z"
        fill="#F59E0B"
      />
    </svg>
  );
}

const TRUST_BADGES = [
  {
    id: 'halal',
    title: 'Tersertifikasi Halal',
    subtitle: 'Proses produksi & bahan sesuai standar Halal Indonesia',
    Emblem: HalalEmblemSvg,
  },
  {
    id: 'pirt',
    title: 'Sertifikasi P-IRT Resmi',
    subtitle: 'Teruji keamanan pangan & terdaftar resmi siap edar',
    Emblem: PirtEmblemSvg,
  },
  {
    id: 'kedelai',
    title: '100% Kedelai Pilihan',
    subtitle: 'Fermentasi kedelai utuh grade A tanpa campuran tepung berlebih',
    Emblem: SoybeanEmblemSvg,
  },
  {
    id: 'higienis',
    title: 'Standar Higienis PT Hana Food',
    subtitle: 'Pengemasan standing pouch kedap udara & kontrol mutu harian',
    Emblem: HygienicEmblemSvg,
  },
];

export function TrustBadgesStrip() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      aria-label="Sertifikasi dan Jaminan Kualitas Produk"
      className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-10 pb-2"
    >
      <div className="border-b border-[#ECE3C8] pb-10">
        <div className="text-center mb-6">
          <p className="text-xs font-extrabold text-[#157A28] tracking-wide">
            Jaminan Kualitas &amp; Keamanan Pangan PT Hana Food Indonesia
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
          {TRUST_BADGES.map((badge, index) => {
            const Emblem = badge.Emblem;
            return (
              <motion.div
                key={badge.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.4,
                  delay: prefersReducedMotion ? 0 : index * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="flex items-center gap-3.5 bg-white/80 border border-[#EDE4C8] rounded-2xl px-4 py-3.5"
              >
                <Emblem />
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-[#135E20] leading-snug">
                    {badge.title}
                  </h3>
                  <p className="text-xs text-[#4B5847] leading-relaxed mt-0.5">
                    {badge.subtitle}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
