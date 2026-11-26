import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Dumbbell,
  Heart,
  Leaf,
  MessageCircle,
  Package,
  ShieldCheck,
  ShoppingCart,
  ThumbsUp,
  Truck,
} from 'lucide-react';
import {
  BRAND_INFO,
  INGREDIENTS_LIST,
  NUTRITION_FACTS,
  PRODUCT_PACKAGES,
  VERIFIED_TESTIMONIALS,
  formatRupiah,
} from '../data/catalog.ts';
import { submitLead, trackAnalyticsEvent } from '../lib/api.ts';
import type { PackageId } from '../types.ts';
import { AnimatedCounter } from './AnimatedCounter.tsx';
import { OrderTrackerSection } from './OrderTrackerSection.tsx';
import { TestimonialSlider } from './TestimonialSlider.tsx';
import { TrustBadgesStrip } from './TrustBadgesStrip.tsx';

interface LandingSalesPageProps {
  packsDelivered: number;
  activeCustomers: number;
  recentOrderCode?: string | null;
  onSelectPackage: (packageId: PackageId, sourceLabel: string) => void;
  onOpenTracking: (orderCode?: string) => void;
  onOpenDashboard: () => void;
  onNotify: (message: string) => void;
}

const HERO_BENEFITS = [
  { icon: Leaf, title: '100%', subtitle: 'Bahan Alami' },
  { icon: ShieldCheck, title: 'Tanpa', subtitle: 'Pengawet' },
  { icon: Heart, title: 'Rendah', subtitle: 'Kolesterol' },
  { icon: Dumbbell, title: 'Sumber', subtitle: 'Protein Nabati' },
  { icon: ThumbsUp, title: 'Lezat &', subtitle: 'Bergizi' },
];

const WHY_POINTS = [
  'Rasa Original yang Gurih dan Lezat',
  'Dibuat dari Tempe Kedelai Pilihan',
  'Tanpa Pengawet dan Pewarna Buatan',
  'Sehat untuk Seluruh Keluarga',
  'Kemasan Praktis, Higienis, dan Modern',
];

const GREEN_BAND_ADVANTAGES = [
  'Renyah & Gurih Bikin Nagih',
  'Sehat & Bergizi dari Tempe Pilihan',
  'Tanpa Pengawet & Bahan Kimia',
  'Lebih Aman untuk Anak & Keluarga',
  'Praktis & Mudah Dibawa ke Mana Saja',
];

function LeafAccentSvg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M18 102C22 50 56 18 106 14C102 64 70 98 18 102Z"
        fill="url(#umiLeafGrad)"
      />
      <path
        d="M20 100C46 74 72 48 102 18"
        stroke="#D9F99D"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <defs>
        <linearGradient id="umiLeafGrad" x1="18" y1="102" x2="106" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#166534" />
          <stop offset="0.55" stopColor="#22A03B" />
          <stop offset="1" stopColor="#65C932" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LandingSalesPage({
  packsDelivered,
  activeCustomers,
  recentOrderCode,
  onSelectPackage,
  onOpenTracking,
  onOpenDashboard,
  onNotify,
}: LandingSalesPageProps) {
  const prefersReducedMotion = useReducedMotion();
  const [packagingImgFailed, setPackagingImgFailed] = useState(false);
  const [bowlImgFailed, setBowlImgFailed] = useState(false);
  const [familyImgFailed, setFamilyImgFailed] = useState(false);
  const [heroModelImgFailed, setHeroModelImgFailed] = useState(false);

  // CRM Consultation Lead Form state
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadCity, setLeadCity] = useState('');
  const [leadPackage, setLeadPackage] = useState('Paket Kantor & Reseller (15 Bungkus)');
  const [leadNotes, setLeadNotes] = useState('');
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadSuccess, setLeadSuccess] = useState<{
    name: string;
    waLink: string | null;
  } | null>(null);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError(null);
    if (leadName.trim().length < 2) {
      setLeadError('Mohon isi nama lengkap Anda.');
      return;
    }
    if (leadPhone.replace(/[^0-9]/g, '').length < 10) {
      setLeadError('Masukkan nomor WhatsApp aktif minimal 10 digit.');
      return;
    }

    setLeadSubmitting(true);
    try {
      const estimatedValue = leadPackage.includes('15')
        ? 195000
        : leadPackage.includes('6')
          ? 84000
          : 45000;
      const result = await submitLead({
        name: leadName.trim(),
        phone: leadPhone.trim(),
        city: leadCity.trim() || 'Indonesia',
        source: 'Form Konsultasi',
        packageInterest: leadPackage,
        estimatedValue,
        notes: leadNotes.trim() || 'Tertarik penawaran paket dan pengiriman Umi Hana.',
      });
      setLeadSuccess({
        name: result.lead.name,
        waLink: result.scheduledFollowUp?.waLink ?? null,
      });
      setLeadName('');
      setLeadPhone('');
      setLeadCity('');
      setLeadNotes('');
      onNotify('Data tersimpan di CRM. Tim Umi Hana siap menghubungi Anda via WhatsApp.');
    } catch (err) {
      setLeadError(err instanceof Error ? err.message : 'Gagal mengirim permintaan konsultasi.');
    } finally {
      setLeadSubmitting(false);
    }
  };

  const directWhatsAppUrl = `https://wa.me/${BRAND_INFO.whatsappNormalized}?text=${encodeURIComponent(
    'Halo Umi Hana, saya ingin memesan Kripik Tempe Rasa Original dan tanya promo pengiriman hari ini.'
  )}`;

  return (
    <main className="bg-[#FFFDF5] overflow-x-clip">
      {/* SECTION 1: VIBRANT SUNLIT HERO STAGE */}
      <section className="relative bg-[radial-gradient(ellipse_at_55%_35%,#FFFDF2_0%,#F6FBE5_48%,#DFF1C8_100%)] pt-8 pb-20 lg:pt-12 lg:pb-24 overflow-hidden">
        {/* Ambient organic sunlit leaf silhouettes */}
        <motion.div
          animate={{ rotate: [0, 3, 0], y: [0, -5, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none select-none absolute -top-6 -left-8 w-28 sm:w-40 opacity-30"
        >
          <LeafAccentSvg className="w-full h-full -rotate-12" />
        </motion.div>
        <motion.div
          animate={{ rotate: [0, -4, 0], y: [0, 6, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="pointer-events-none select-none absolute top-12 -right-10 w-32 sm:w-44 opacity-25"
        >
          <LeafAccentSvg className="w-full h-full rotate-90" />
        </motion.div>

        {/* Warm sunlit golden-wood tabletop horizon strip */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-[#EBD39E]/70 via-[#DFBE7B]/85 to-[#CFA65A]/90 border-t border-[#F7E7BD]"
        />

        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-5 lg:gap-y-4 lg:gap-x-6 items-center">
            {/* Hero Block 1: Brand Title (Top on mobile, top-left on desktop) */}
            <div className="order-1 lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:self-end space-y-2 text-center lg:text-left">
              <p className="font-display italic font-bold text-lg sm:text-xl text-[#146523]">
                Camilan Sehat untuk Keluarga Tercinta...
              </p>

              <h1 className="font-display italic font-extrabold text-[clamp(3rem,5.5vw,4.5rem)] leading-[0.98] tracking-tight text-[#157A28] umi-brand-outline">
                Umi Hana
              </h1>
            </div>

            {/* Hero Block 2: Cheerful Ambassador + Standing Pouch Showcase (Directly below "Umi Hana" on mobile, right showcase on desktop matching reference) */}
            <div className="order-2 lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:row-span-2 lg:self-end relative flex items-end justify-center min-h-[250px] sm:min-h-[360px] lg:min-h-[450px] pt-2 lg:pt-4">
              {/* Warm sunlit radiant halo behind hero visuals */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 sm:w-[420px] sm:h-[420px] rounded-full bg-[radial-gradient(circle,rgba(255,246,192,0.95)_0%,rgba(255,250,224,0.45)_55%,transparent_75%)]"
              />

              {/* Center-left foreground: Brand ambassador holding crispy tempe & woven tray */}
              <div className="relative z-10 w-[92%] sm:w-[78%] lg:w-[75%] mx-auto lg:mr-auto lg:ml-0">
                {!heroModelImgFailed ? (
                  <img
                    src={BRAND_INFO.heroModelImage}
                    alt="Wanita tersenyum memegang kripik tempe renyah Umi Hana bersama tampah kripik tempe dan kedelai pilihan"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroModelImgFailed(true)}
                    className="w-full h-auto object-contain object-bottom drop-shadow-[0_18px_26px_rgba(74,37,17,0.22)]"
                  />
                ) : !bowlImgFailed ? (
                  <img
                    src={BRAND_INFO.bowlImage}
                    alt="Mangkuk kayu penuh kripik tempe renyah keemasan Umi Hana"
                    referrerPolicy="no-referrer"
                    onError={() => setBowlImgFailed(true)}
                    className="w-full max-w-[320px] mx-auto h-auto object-contain"
                  />
                ) : null}
              </div>

              {/* Right edge: Standing Pouch front view (hidden on mobile, visible on desktop matching reference) */}
              <motion.div
                animate={prefersReducedMotion ? undefined : { y: [0, -6, 0] }}
                transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
                className="hidden lg:block absolute z-20 right-1 bottom-2 w-[35%] max-w-[235px]"
              >
                {!packagingImgFailed ? (
                  <div className="overflow-hidden drop-shadow-[0_18px_28px_rgba(20,58,24,0.28)]">
                    <img
                      src={BRAND_INFO.packagingImage}
                      alt="Kemasan Standing Pouch Umi Hana Kripik Tempe Rasa Original 60 gram"
                      referrerPolicy="no-referrer"
                      onError={() => setPackagingImgFailed(true)}
                      className="w-[200%] max-w-none h-auto block"
                    />
                  </div>
                ) : (
                  <div className="w-full h-44 rounded-2xl bg-[#E8F4DC] flex flex-col items-center justify-center text-center p-4">
                    <Package className="w-8 h-8 text-[#157A28] mb-1" />
                    <span className="font-display text-xs font-bold text-[#146523]">Umi Hana 60g</span>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Hero Block 3: Subtitle, Ribbon, Copy & CTAs (Below product image on mobile, bottom-left on desktop) */}
            <div className="order-3 lg:col-span-5 lg:col-start-1 lg:row-start-2 lg:self-start space-y-4 text-center lg:text-left pb-2 lg:pb-6">
              <div className="font-display italic font-bold text-[clamp(2rem,3.4vw,2.85rem)] leading-tight text-[#4A2511]">
                Kripik Tempe
              </div>

              {/* Lush Green Rasa Original Ribbon */}
              <div className="flex items-center justify-center lg:justify-start gap-2.5">
                <span className="inline-block w-5 h-1.5 rounded-full bg-[#FACC15] -rotate-12" aria-hidden="true" />
                <span className="inline-block px-6 py-1.5 bg-gradient-to-r from-[#146B24] via-[#1C8B30] to-[#146B24] text-white font-display italic font-bold text-lg sm:text-xl rounded-xl shadow-md -rotate-1">
                  Rasa Original
                </span>
                <span className="inline-block w-5 h-1.5 rounded-full bg-[#FACC15] rotate-12" aria-hidden="true" />
              </div>

              <p className="font-display italic font-bold text-xl sm:text-2xl text-[#3B2613]">
                Gurih, Renyah, &amp; Bergizi
              </p>

              <p className="text-sm sm:text-base text-[#3D4B38] leading-relaxed max-w-lg mx-auto lg:mx-0">
                Irisan tempe kedelai pilihan yang tipis, renyah alami, kaya <strong className="text-[#146523]">18 g protein nabati</strong> per 60 g, dan diproduksi higienis oleh PT Hana Food Indonesia.
              </p>

              {/* Prominent Golden CTA + Lively WhatsApp CTA */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onSelectPackage('keluarga-6', 'Hero Primary CTA')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-extrabold text-[#1E2E14] bg-gradient-to-b from-[#FFE047] to-[#F4B400] hover:from-[#FACC15] hover:to-[#E2A100] rounded-full shadow-[0_10px_24px_rgba(234,179,8,0.4)] transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Pesan Sekarang
                  <ArrowRight className="w-5 h-5" />
                </button>

                <a
                  href={directWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void trackAnalyticsEvent('whatsapp_click', 'Hero Chat Yuk')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold text-white bg-[#177A28] hover:bg-[#11601E] rounded-full shadow-md transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat Yuk!
                </a>
              </div>

              <div className="text-xs font-medium text-[#3D4B38] pt-1">
                QRIS Instan · Virtual Account Bank · GoPay · Bayar di Tempat (COD) · Garansi Ganti Baru
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FLOATING 5-BENEFIT RIBBON BAR (OVERLAPPING TABLETOP) */}
      <div className="relative z-20 max-w-[1120px] mx-auto px-4 sm:px-6 -mt-10">
        <div className="bg-[#FFFDF5] border border-[#EAE0C1] rounded-2xl shadow-[0_14px_34px_rgba(74,47,16,0.1)] px-4 py-5 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-2 lg:divide-x lg:divide-[#ECE3C8]">
            {HERO_BENEFITS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.subtitle}
                  className="flex items-center justify-center gap-3 px-2 py-1"
                >
                  <span className="w-10 h-10 rounded-full bg-[#EAF7E4] text-[#177A28] inline-flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="text-left leading-tight">
                    <div className="text-xs sm:text-sm font-extrabold text-[#1C2A1A]">{item.title}</div>
                    <div className="text-xs font-semibold text-[#3C4B38]">{item.subtitle}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* TRUST BADGES STRIP (HALAL, P-IRT, 100% KEDELAI PILIHAN, STANDAR HIGIENIS) */}
      <TrustBadgesStrip />

      {/* SECTION 2: KENAPA PILIH UMI HANA? */}
      <section id="keunggulan" className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-12 pb-14 lg:pt-16 lg:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.35 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center"
        >
          {/* Left: Title + 5 Checklist Advantages */}
          <div className="lg:col-span-4 space-y-6">
            <div>
              <h2 className="font-display italic font-extrabold text-3xl sm:text-4xl text-[#135E20] tracking-tight">
                Kenapa Pilih Umi Hana?
              </h2>
              <svg
                viewBox="0 0 260 14"
                fill="none"
                aria-hidden="true"
                className="w-56 h-3.5 mt-1.5"
              >
                <path
                  d="M4 10C65 3 185 2 256 9"
                  stroke="#FACC15"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <ul className="space-y-3.5">
              {WHY_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm sm:text-base font-medium text-[#1C2A1A]">
                  <span className="w-6 h-6 rounded-full bg-[#229834] text-white inline-flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Center: Appetizing Crispy Bowl Close-up */}
          <div className="lg:col-span-3 flex items-center justify-center relative py-4">
            <div
              aria-hidden="true"
              className="absolute w-56 h-56 rounded-full bg-[radial-gradient(circle,#FEF08A_0%,rgba(254,240,138,0.2)_60%,transparent_75%)]"
            />
            {!bowlImgFailed ? (
              <motion.img
                whileHover={{ scale: 1.04, rotate: -1 }}
                transition={{ duration: 0.2 }}
                src={BRAND_INFO.bowlImage}
                alt="Tekstur tipis dan renyah Kripik Tempe Umi Hana dalam mangkuk kayu"
                referrerPolicy="no-referrer"
                onError={() => setBowlImgFailed(true)}
                className="relative z-10 w-60 sm:w-64 h-auto object-contain drop-shadow-[0_18px_26px_rgba(74,37,17,0.22)]"
              />
            ) : (
              <div className="relative z-10 w-60 h-48 rounded-2xl bg-[#F4EED9] flex items-center justify-center text-sm text-[#4A2511]">
                Kripik Tempe Umi Hana
              </div>
            )}
          </div>

          {/* Right: Two-Tone Yellow/Cream Callout Bubble + Freely Overlapping Family Cutout (Matching Reference) */}
          <div className="lg:col-span-5 space-y-5">
            <div className="relative flex flex-col sm:flex-row items-center sm:items-end justify-center pt-2">
              {/* Two-Tone Tilted Speech Callout Card */}
              <div className="relative z-10 w-full sm:w-[58%] rounded-[24px] overflow-hidden shadow-[0_12px_28px_rgba(180,130,10,0.14)] -rotate-[1.5deg] bg-[#FFF9D6]">
                {/* Bright Butter-Yellow Top Header */}
                <div className="relative bg-gradient-to-b from-[#FFF27A] to-[#FDE75D] px-5 pt-5 pb-4 sm:pr-7">
                  <h3 className="font-display italic font-extrabold text-[22px] sm:text-2xl text-[#0D4A1B] leading-tight">
                    Cocok untuk siapa?
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      aria-hidden="true"
                      className="inline-block w-3.5 h-3 rounded-[60%_40%_55%_45%] bg-[#F4BA00] shadow-xs shrink-0"
                    />
                    <span className="text-sm sm:text-[15px] font-extrabold text-[#0D4A1B]">
                      Semua kalangan!
                    </span>
                  </div>
                  {/* Curved Downward Speech Notch into Cream Body */}
                  <svg
                    viewBox="0 0 120 18"
                    aria-hidden="true"
                    className="absolute left-1/2 -translate-x-1/2 -bottom-[14px] w-14 h-4 text-[#FDE75D]"
                    fill="currentColor"
                  >
                    <path d="M0,0 C28,0 44,4 60,18 C76,4 92,0 120,0 Z" />
                  </svg>
                </div>

                {/* Soft Pale Cream Bottom Body */}
                <div className="bg-gradient-to-b from-[#FFF9D6] to-[#FEF6C7] px-5 pt-6 pb-5 sm:pr-8">
                  <p className="text-[14px] sm:text-[15px] font-semibold text-[#1E2E1A] leading-snug">
                    Anak-anak, remaja, dewasa hingga lansia yang peduli kesehatan.
                  </p>
                </div>
              </div>

              {/* Cheerful Family Cutout Standing Freely & Overlapping Right Edge */}
              {!familyImgFailed && (
                <div className="relative z-20 w-[82%] max-w-[290px] sm:max-w-none sm:w-[56%] -mt-4 sm:mt-0 sm:-ml-10 flex items-end justify-center pointer-events-none select-none">
                  <img
                    src={BRAND_INFO.familyImage}
                    alt="Keluarga ceria menikmati Kripik Tempe Umi Hana bersama anak-anak"
                    referrerPolicy="no-referrer"
                    onError={() => setFamilyImgFailed(true)}
                    className="w-full h-auto object-contain object-bottom drop-shadow-[0_12px_20px_rgba(74,37,17,0.16)]"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-white border border-[#EAE0C1] rounded-xl p-3.5">
                <div className="font-mono-tabular text-lg sm:text-xl font-extrabold text-[#157A28]">
                  <AnimatedCounter value={packsDelivered} durationMs={1500} suffix="+" />
                </div>
                <div className="text-[11px] font-medium text-[#525C53] mt-0.5">
                  Kemasan Terkirim
                </div>
              </div>
              <div className="bg-white border border-[#EAE0C1] rounded-xl p-3.5">
                <div className="font-mono-tabular text-lg sm:text-xl font-extrabold text-[#B45309]">
                  <AnimatedCounter value={activeCustomers} durationMs={1400} suffix="+" />
                </div>
                <div className="text-[11px] font-medium text-[#525C53] mt-0.5">
                  Pelanggan Aktif · Rating 4,9/5,0
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* SECTION 3: SIGNATURE LUSH CURVED GREEN WAVE BAND — DETAIL PRODUK & KEUNGGULAN */}
      <section className="relative">
        {/* Top Organic Green Wave */}
        <svg
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="block w-full h-10 sm:h-16 -mb-px"
        >
          <path
            d="M0,36 C280,82 540,4 860,40 C1140,72 1320,24 1440,34 L1440,80 L0,80 Z"
            fill="#177A28"
          />
        </svg>

        <div className="bg-gradient-to-b from-[#177A28] via-[#136A22] to-[#0E541A] text-white py-12 lg:py-16">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-center">
              {/* Left: Detail Produk */}
              <div className="order-2 lg:order-1 lg:col-span-4 space-y-5">
                <div className="flex items-center gap-2.5">
                  <Leaf className="w-7 h-7 text-[#FDE047] shrink-0" />
                  <h2 className="font-display italic font-extrabold text-3xl text-white tracking-tight">
                    Detail Produk
                  </h2>
                </div>

                <p className="text-sm sm:text-[15px] text-white/90 leading-relaxed">
                  Umi Hana Kripik Tempe adalah camilan lezat dari tempe pilihan, diolah dengan proses higienis oleh PT Hana Food Indonesia untuk menghasilkan kripik yang renyah, gurih, dan tahan lama.
                </p>

                <dl className="space-y-2.5 text-sm pt-1">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#FDE047] shrink-0" />
                    <dt className="w-28 text-white/80 shrink-0">Berat Bersih</dt>
                    <dd className="font-mono-tabular font-bold text-white">: 60 Gram / pouch</dd>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#FDE047] shrink-0" />
                    <dt className="w-28 text-white/80 shrink-0">Varian Rasa</dt>
                    <dd className="font-bold text-white">: Original Gurih Alami</dd>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#FDE047] shrink-0" />
                    <dt className="w-28 text-white/80 shrink-0">Kemasan</dt>
                    <dd className="font-bold text-white">: Standing Pouch Full Color</dd>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#FDE047] shrink-0" />
                    <dt className="w-28 text-white/80 shrink-0">Komposisi</dt>
                    <dd className="text-white/95">: {INGREDIENTS_LIST.join(', ')}</dd>
                  </div>
                </dl>
              </div>

              {/* Center: Floating Packaging Highlight (top on mobile) */}
              <div className="order-1 lg:order-2 lg:col-span-4 flex items-center justify-center relative py-2 lg:py-4">
                <div
                  aria-hidden="true"
                  className="absolute w-64 h-64 rounded-full bg-[radial-gradient(circle,rgba(254,240,138,0.45)_0%,rgba(255,255,255,0.12)_55%,transparent_75%)]"
                />
                {!packagingImgFailed ? (
                  <motion.img
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
                    src={BRAND_INFO.packagingImage}
                    alt="Kemasan resmi depan dan belakang Umi Hana Kripik Tempe Rasa Original"
                    referrerPolicy="no-referrer"
                    onError={() => setPackagingImgFailed(true)}
                    className="relative z-10 w-full max-w-[330px] h-auto object-contain drop-shadow-[0_22px_32px_rgba(0,0,0,0.32)]"
                  />
                ) : null}
              </div>

              {/* Right: Keunggulan & Family Tagline */}
              <div className="order-3 lg:order-3 lg:col-span-4 space-y-5">
                <div className="flex items-center gap-2.5">
                  <Award className="w-7 h-7 text-[#FDE047] shrink-0" />
                  <h2 className="font-display italic font-extrabold text-3xl text-white tracking-tight">
                    Keunggulan
                  </h2>
                </div>

                <ul className="space-y-3">
                  {GREEN_BAND_ADVANTAGES.map((adv) => (
                    <li key={adv} className="flex items-start gap-2.5 text-sm sm:text-[15px] text-white/95 font-medium">
                      <span className="w-5 h-5 rounded-full bg-[#4ADE80]/25 border border-[#86EFAC]/50 text-[#FDE047] inline-flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                      <span>{adv}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2">
                  <p className="font-display italic font-extrabold text-2xl text-[#FDE047] leading-snug">
                    Tempe Jadi Camilan Favorit Keluarga!
                  </p>
                </div>
              </div>
            </div>

            {/* Clean Nutrition Strip inside the Green Band */}
            <div className="bg-white/10 border border-white/20 rounded-2xl p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-sm font-bold text-white">
                  Informasi Nilai Gizi Resmi (per 60 g kemasan)
                </h3>
                <span className="text-xs text-white/80">
                  Simpan di tempat sejuk dan kering, hindarkan dari sinar matahari langsung
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {NUTRITION_FACTS.map((fact) => (
                  <div
                    key={fact.label}
                    className="bg-black/15 border border-white/10 rounded-xl px-4 py-3 text-center"
                  >
                    <div className="font-mono-tabular text-xl font-extrabold text-[#FDE047]">
                      {fact.value}
                    </div>
                    <div className="text-xs font-semibold text-white mt-0.5">{fact.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Organic Green Wave */}
        <svg
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="block w-full h-10 sm:h-16 -mt-px"
        >
          <path
            d="M0,0 L1440,0 L1440,42 C1180,82 880,10 560,48 C290,80 120,26 0,44 Z"
            fill="#0E541A"
          />
        </svg>
      </section>

      {/* SECTION 4: SALES PAGE — PILIHAN PAKET & PROMO KONVERSI */}
      <section id="paket" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-14 lg:py-20">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-2xl mx-auto mb-12 space-y-3"
        >
          <div className="inline-flex items-center justify-center gap-3">
            <span className="w-10 h-1 rounded-full bg-[#229834]" aria-hidden="true" />
            <span className="text-xs font-extrabold text-[#157A28] tracking-wide">
              Penawaran Langsung Pabrik PT Hana Food
            </span>
            <span className="w-10 h-1 rounded-full bg-[#FACC15]" aria-hidden="true" />
          </div>
          <h2 className="font-display italic font-extrabold text-3xl sm:text-4xl text-[#135E20] tracking-tight">
            Pilih Paket Favorit Keluarga Anda
          </h2>
          <p className="text-sm sm:text-base text-[#4B5847]">
            Pesan sebelum pukul 15.00 WIB untuk pengiriman di hari yang sama. Nikmati gratis ongkir reguler untuk paket 6 &amp; 15 pouch.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {PRODUCT_PACKAGES.map((pkg, index) => {
            const savings = pkg.compareAtPrice - pkg.price;
            const isThirdCard = index === 2;
            return (
              <motion.div
                key={pkg.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 28, scale: 0.98 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{
                  duration: 0.5,
                  delay: prefersReducedMotion ? 0 : index * 0.12,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={`rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-shadow duration-200 ${
                  isThirdCard
                    ? 'md:col-span-2 md:max-w-[calc(50%-0.75rem)] md:mx-auto lg:col-span-1 lg:max-w-none lg:mx-0 w-full'
                    : ''
                } ${
                  pkg.recommended
                    ? 'bg-gradient-to-b from-[#F2FAE9] to-[#FFFDF5] border-2 border-[#177A28] shadow-[0_14px_34px_rgba(23,122,40,0.14)] hover:shadow-[0_20px_42px_rgba(23,122,40,0.2)]'
                    : 'bg-white border border-[#EAE0C1] shadow-[0_6px_20px_rgba(74,37,17,0.05)] hover:shadow-[0_14px_30px_rgba(74,37,17,0.1)]'
                }`}
              >
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[#525C53] font-medium">{pkg.audience}</span>
                      {pkg.recommended && (
                        <span className="font-extrabold text-[#157A28] whitespace-nowrap">
                          Paling Laris
                        </span>
                      )}
                    </div>
                    <h3 className="font-display italic font-bold text-2xl text-[#1C2A1A] mt-2">
                      {pkg.name}
                    </h3>
                  </div>

                  <div className="pb-5 border-b border-[#EAE0C1]">
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-mono-tabular text-3xl font-extrabold text-[#135E20]">
                        {formatRupiah(pkg.price)}
                      </span>
                      <span className="font-mono-tabular text-sm text-[#868E80] line-through">
                        {formatRupiah(pkg.compareAtPrice)}
                      </span>
                    </div>
                    <div className="text-xs text-[#B45309] font-semibold mt-1.5 font-mono-tabular">
                      {formatRupiah(pkg.pricePerPack)} / pouch · Hemat {formatRupiah(savings)}
                    </div>
                  </div>

                  <p className="text-sm text-[#4B5847] leading-relaxed">{pkg.summary}</p>

                  <ul className="space-y-2.5 text-sm text-[#1C2A1A]">
                    {pkg.highlights.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-[#EAF7E4] text-[#177A28] inline-flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-8">
                  <button
                    type="button"
                    onClick={() => onSelectPackage(pkg.id, `Sales Card: ${pkg.name}`)}
                    className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-extrabold rounded-full transition-all duration-150 cursor-pointer ${
                      pkg.recommended
                        ? 'bg-gradient-to-b from-[#FFE047] to-[#F4B400] hover:from-[#FACC15] hover:to-[#E2A100] text-[#1E2E14] shadow-[0_8px_20px_rgba(234,179,8,0.35)]'
                        : 'bg-[#177A28] hover:bg-[#11601E] text-white shadow-sm'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Pesan {pkg.name}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Integrated Payment & Guarantee Strip */}
        <div className="mt-10 bg-[#FEF8E2] border border-[#EFE1AE] rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#177A28] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[#1C2A1A]">Garansi Renyah &amp; Utuh 100%</div>
              <p className="text-xs text-[#4B5847] mt-1 leading-relaxed">
                Kemasan tiba rusak atau melempem? Kirim foto lewat WhatsApp dan kami ganti baru gratis.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Truck className="w-5 h-5 text-[#177A28] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[#1C2A1A]">Pembayaran Instan &amp; COD</div>
              <p className="text-xs text-[#4B5847] mt-1 leading-relaxed">
                Mendukung QRIS, Virtual Account (BCA, Mandiri, BNI), GoPay, dan Bayar di Tempat (COD).
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-[#177A28] shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[#1C2A1A]">Tersinkronisasi CRM &amp; WhatsApp</div>
              <p className="text-xs text-[#4B5847] mt-1 leading-relaxed">
                Status pesanan, pengingat pembayaran, dan nomor resi langsung terpantau lewat WhatsApp resmi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: SLIDER TESTIMONI PELANGGAN */}
      <TestimonialSlider testimonials={VERIFIED_TESTIMONIALS} />

      {/* SECTION 6: PELACAKAN PESANAN (SYNCED WITH CRM) */}
      <OrderTrackerSection
        recentOrderCode={recentOrderCode}
        onOpenDedicatedTracking={onOpenTracking}
      />

      {/* SECTION 7: KONSULTASI GROSIR & CRM LEAD CAPTURE */}
      <section id="konsultasi" className="bg-[#FAF5E4]/60 border-t border-[#ECE2C3] py-16 lg:py-20">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          <div className="lg:col-span-5 space-y-5">
            <p className="text-xs font-extrabold text-[#157A28]">
              Kemitraan Reseller &amp; Pemesanan Korporat
            </p>
            <h2 className="font-display italic font-extrabold text-3xl sm:text-4xl text-[#135E20] tracking-tight">
              Butuh harga grosir atau jadwal kirim rutin?
            </h2>
            <p className="text-sm sm:text-base text-[#4B5847] leading-relaxed">
              Isi formulir singkat ini untuk menerima daftar harga grosir PT Hana Food Indonesia. Data Anda langsung terhubung ke sistem CRM dan tindak lanjut otomatis WhatsApp kami.
            </p>

            <div className="pt-4 border-t border-[#EAE0C1] space-y-2.5 text-sm text-[#4B5847]">
              <div>
                <span className="font-bold text-[#1C2A1A]">WhatsApp Pemesanan Resmi:</span>{' '}
                <span className="font-mono-tabular font-semibold text-[#157A28]">
                  {BRAND_INFO.whatsappDisplay}
                </span>
              </div>
              <div>
                <span className="font-bold text-[#1C2A1A]">Jam Operasional Kirim:</span> Senin–Sabtu, 08.00–17.00 WIB
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenDashboard}
                  className="text-sm font-bold text-[#157A28] hover:text-[#0E511B] underline underline-offset-4 cursor-pointer"
                >
                  Buka Dashboard CRM, Analitik Real-Time &amp; Otomasi WhatsApp →
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white border border-[#EAE0C1] rounded-2xl p-6 sm:p-8 shadow-[0_8px_24px_rgba(74,37,17,0.05)]">
              {leadSuccess ? (
                <div className="space-y-4 py-4">
                  <div className="inline-flex items-center gap-2 text-sm font-bold text-[#157A28]">
                    <Check className="w-5 h-5" />
                    Permintaan Tercatat di CRM Umi Hana
                  </div>
                  <h3 className="font-display italic font-bold text-2xl text-[#1C2A1A]">
                    Terima kasih, {leadSuccess.name}.
                  </h3>
                  <p className="text-sm text-[#4B5847] leading-relaxed">
                    Data Anda sudah masuk ke pipeline prospek dan antrean follow-up WhatsApp otomatis kami. Anda juga dapat langsung memulai percakapan sekarang.
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <a
                      href={leadSuccess.waLink || directWhatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-3 text-sm font-bold text-white bg-[#177A28] hover:bg-[#11601E] rounded-full transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Lanjut Chat di WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={() => setLeadSuccess(null)}
                      className="px-5 py-3 text-sm font-semibold text-[#1C2A1A] bg-[#FFFDF5] border border-[#DCD2B2] hover:bg-[#F7F1DC] rounded-full transition-colors cursor-pointer"
                    >
                      Kirim Permintaan Lain
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleLeadSubmit} className="space-y-4">
                  <h3 className="text-base font-bold text-[#1C2A1A]">
                    Minta Penawaran &amp; Pengingat Stok via WhatsApp
                  </h3>

                  {leadError && (
                    <div
                      role="alert"
                      className="px-4 py-3 text-sm text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-xl"
                    >
                      {leadError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="lead-name" className="block text-xs font-semibold text-[#4B5847] mb-1">
                        Nama Lengkap *
                      </label>
                      <input
                        id="lead-name"
                        type="text"
                        required
                        value={leadName}
                        onChange={(e) => setLeadName(e.target.value)}
                        placeholder="Nama Anda"
                        className="w-full px-3.5 py-2.5 text-sm bg-[#FFFDF5] border border-[#DCD2B2] rounded-xl focus:outline-none focus:bg-white focus:border-[#177A28]"
                      />
                    </div>
                    <div>
                      <label htmlFor="lead-phone" className="block text-xs font-semibold text-[#4B5847] mb-1">
                        Nomor WhatsApp *
                      </label>
                      <input
                        id="lead-phone"
                        type="tel"
                        required
                        value={leadPhone}
                        onChange={(e) => setLeadPhone(e.target.value)}
                        placeholder="0812xxxxxxxx"
                        className="w-full px-3.5 py-2.5 text-sm bg-[#FFFDF5] border border-[#DCD2B2] rounded-xl focus:outline-none focus:bg-white focus:border-[#177A28]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="lead-city" className="block text-xs font-semibold text-[#4B5847] mb-1">
                        Kota Tujuan
                      </label>
                      <input
                        id="lead-city"
                        type="text"
                        value={leadCity}
                        onChange={(e) => setLeadCity(e.target.value)}
                        placeholder="Contoh: Surabaya"
                        className="w-full px-3.5 py-2.5 text-sm bg-[#FFFDF5] border border-[#DCD2B2] rounded-xl focus:outline-none focus:bg-white focus:border-[#177A28]"
                      />
                    </div>
                    <div>
                      <label htmlFor="lead-pkg" className="block text-xs font-semibold text-[#4B5847] mb-1">
                        Paket yang Diminati
                      </label>
                      <select
                        id="lead-pkg"
                        value={leadPackage}
                        onChange={(e) => setLeadPackage(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-[#FFFDF5] border border-[#DCD2B2] rounded-xl focus:outline-none focus:bg-white focus:border-[#177A28]"
                      >
                        <option value="Paket Coba Keluarga (3 Bungkus)">Paket Coba Keluarga (3 Bungkus)</option>
                        <option value="Paket Stok Rumah (6 Bungkus)">Paket Stok Rumah (6 Bungkus)</option>
                        <option value="Paket Kantor & Reseller (15 Bungkus)">Paket Kantor &amp; Reseller (15 Bungkus)</option>
                        <option value="Kemitraan Reseller > 50 Bungkus">Kemitraan Reseller &gt; 50 Bungkus</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="lead-notes" className="block text-xs font-semibold text-[#4B5847] mb-1">
                      Catatan Kebutuhan (Opsional)
                    </label>
                    <textarea
                      id="lead-notes"
                      rows={3}
                      value={leadNotes}
                      onChange={(e) => setLeadNotes(e.target.value)}
                      placeholder="Misal: untuk hampers kantor minggu depan, atau ingin tanya margin reseller"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FFFDF5] border border-[#DCD2B2] rounded-xl focus:outline-none focus:bg-white focus:border-[#177A28]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={leadSubmitting}
                    className="w-full sm:w-auto px-7 py-3.5 text-sm font-bold text-white bg-[#177A28] hover:bg-[#11601E] disabled:opacity-60 rounded-full shadow-sm transition-colors cursor-pointer"
                  >
                    {leadSubmitting ? 'Menyimpan ke CRM...' : 'Dapatkan Penawaran via WhatsApp'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: VIBRANT CLOSING GREEN BANNER (INSPIRED DIRECTLY BY REFERENCE) */}
      <section className="relative bg-gradient-to-r from-[#136A22] via-[#1C882E] to-[#136A22] py-12 sm:py-14 overflow-hidden">
        <LeafAccentSvg className="pointer-events-none select-none absolute -left-8 -bottom-8 w-36 opacity-30 rotate-12" />
        <LeafAccentSvg className="pointer-events-none select-none absolute -right-8 -top-8 w-36 opacity-30 -rotate-45" />

        <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-center justify-between gap-8 text-center lg:text-left">
          <div className="space-y-1">
            <h2 className="font-display italic font-extrabold text-3xl sm:text-4xl text-white leading-tight">
              Nikmati Kelezatan Kripik Tempe Umi Hana
              <span className="block text-[#FDE047]">Sekarang Juga!</span>
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3.5 shrink-0">
            <button
              type="button"
              onClick={() => onSelectPackage('keluarga-6', 'Closing Banner CTA')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 text-sm sm:text-base font-extrabold text-[#1E2E14] bg-gradient-to-b from-[#FFE047] to-[#F4B400] hover:from-[#FACC15] hover:to-[#E2A100] rounded-full shadow-lg transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingCart className="w-5 h-5" />
              Pesan Sekarang
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href={directWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void trackAnalyticsEvent('whatsapp_click', 'Closing Banner WhatsApp')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white hover:bg-[#FFFDF5] text-[#146523] rounded-full shadow-md transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0"
            >
              <MessageCircle className="w-5 h-5 text-[#177A28] shrink-0" />
              <span className="text-left leading-tight">
                <span className="block text-[11px] font-semibold text-[#4B5847]">Hubungi Kami</span>
                <span className="block font-mono-tabular text-sm font-extrabold text-[#146523]">
                  {BRAND_INFO.whatsappDisplay}
                </span>
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* DARK FOREST GREEN FOOTER */}
      <footer className="bg-[#0C4218] text-white/90">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-sm">
          <div className="flex items-center gap-2.5">
            <Leaf className="w-6 h-6 text-[#86EFAC] shrink-0" aria-hidden="true" />
            <div>
              <div className="font-display font-bold text-base text-white tracking-wide">
                HANA FOOD INDONESIA
              </div>
              <div className="text-xs text-white/70">
                Umi Hana Kripik Tempe · WhatsApp {BRAND_INFO.whatsappDisplay}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/80">
            <a href="#keunggulan" className="hover:text-[#FDE047] transition-colors">
              Keunggulan
            </a>
            <a href="#paket" className="hover:text-[#FDE047] transition-colors">
              Paket &amp; Harga
            </a>
            <a href="#testimoni" className="hover:text-[#FDE047] transition-colors">
              Testimoni
            </a>
            <a href="#lacak-pesanan" className="hover:text-[#FDE047] transition-colors">
              Lacak Pesanan
            </a>
            <a href="#konsultasi" className="hover:text-[#FDE047] transition-colors">
              Grosir
            </a>
            <button
              type="button"
              onClick={onOpenDashboard}
              className="text-[#FDE047] hover:underline font-semibold cursor-pointer"
            >
              Portal CRM &amp; Analitik
            </button>
          </div>

          <div className="text-xs text-white/65">
            © 2026 PT HANA FOOD INDONESIA. All Rights Reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}
