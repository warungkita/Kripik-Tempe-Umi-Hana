import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Clock,
  MessageCircle,
  Package,
  PackageCheck,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  X,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { BRAND_INFO, formatRupiah } from '../data/catalog.ts';
import { trackAnalyticsEvent, trackOrderByCode } from '../lib/api.ts';
import type { CrmStage, OrderRecord, OrderTrackingResult } from '../types.ts';

interface OrderTrackingPageProps {
  initialOrderCode?: string | null;
  onBackToStorefront: () => void;
  onQuickOrder: () => void;
}

const DELIVERY_STEPS: Array<{
  key: OrderRecord['fulfillmentStatus'];
  label: string;
  description: string;
  icon: typeof Clock;
}> = [
  {
    key: 'menunggu_bayar',
    label: 'Pesanan Masuk',
    description: 'Menunggu verifikasi pembayaran',
    icon: Clock,
  },
  {
    key: 'dikemas',
    label: 'Sedang Dikemas',
    description: 'Diproses higienis di PT Hana Food',
    icon: Package,
  },
  {
    key: 'dikirim',
    label: 'Dalam Pengiriman',
    description: 'Paket menuju kota tujuan Anda',
    icon: Truck,
  },
  {
    key: 'selesai',
    label: 'Pesanan Tiba',
    description: 'Diterima dengan baik oleh pelanggan',
    icon: PackageCheck,
  },
];

const PAYMENT_STATUS_LABELS: Record<OrderRecord['paymentStatus'], string> = {
  menunggu: 'Menunggu Pembayaran',
  lunas: 'Lunas Terverifikasi',
  cod_diproses: 'COD Diproses',
};

const CRM_STAGE_LABELS: Record<CrmStage, string> = {
  prospek_baru: 'Prospek Baru',
  menunggu_pembayaran: 'Menunggu Pembayaran',
  follow_up_wa: 'Tindak Lanjut WhatsApp Aktif',
  pelanggan_setia: 'Pelanggan Terverifikasi',
  tidak_aktif: 'Arsip',
};

const SAMPLE_ORDERS: Array<{ code: string; statusHint: string }> = [
  { code: 'UH-2026-1042', statusHint: 'Menunggu Bayar' },
  { code: 'UH-2026-1041', statusHint: 'Sedang Dikemas' },
  { code: 'UH-2026-1040', statusHint: 'Dalam Pengiriman' },
  { code: 'UH-2026-1039', statusHint: 'Pesanan Tiba' },
];

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function OrderTrackingPage({
  initialOrderCode,
  onBackToStorefront,
  onQuickOrder,
}: OrderTrackingPageProps) {
  const prefersReducedMotion = useReducedMotion();
  const [query, setQuery] = useState(initialOrderCode ?? '');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<OrderTrackingResult | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const runLookup = useCallback(async (codeToLookup: string, isRefresh = false) => {
    const cleaned = codeToLookup.trim().toUpperCase();
    if (!cleaned) {
      setErrorMsg('Masukkan nomor pesanan Anda (contoh: UH-2026-1040).');
      return;
    }
    setQuery(cleaned);
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMsg(null);
    try {
      const tracking = await trackOrderByCode(cleaned);
      setResult(tracking);
      setLastCheckedAt(new Date().toISOString());
    } catch (err) {
      if (!isRefresh) setResult(null);
      setErrorMsg(err instanceof Error ? err.message : 'Pesanan tidak ditemukan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (initialOrderCode) {
      void runLookup(initialOrderCode);
    }
  }, [initialOrderCode, runLookup]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runLookup(query);
  };

  const activeStepIndex = result
    ? Math.max(0, DELIVERY_STEPS.findIndex((step) => step.key === result.fulfillmentStatus))
    : -1;

  const progressPercentage =
    activeStepIndex >= 0 ? Math.round(((activeStepIndex + 1) / DELIVERY_STEPS.length) * 100) : 0;

  const waSupportHref = result
    ? `https://wa.me/${BRAND_INFO.whatsappNormalized}?text=${encodeURIComponent(
        `Halo Umi Hana, saya ingin menanyakan detail pengiriman untuk pesanan ${result.orderCode} tujuan ${result.city}.`
      )}`
    : `https://wa.me/${BRAND_INFO.whatsappNormalized}?text=${encodeURIComponent(
        'Halo Umi Hana, saya butuh bantuan untuk melacak nomor pesanan Kripik Tempe saya.'
      )}`;

  const sampleList = initialOrderCode
    ? [
        { code: initialOrderCode, statusHint: 'Pesanan Terbaru Anda' },
        ...SAMPLE_ORDERS.filter((item) => item.code !== initialOrderCode).slice(0, 3),
      ]
    : SAMPLE_ORDERS;

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#FFFDF5]">
      {/* Dedicated Top Search Hero */}
      <section className="border-b border-[#EAE0C1] bg-gradient-to-b from-[#FAF5DF]/80 via-[#FFFDF5] to-[#FFFDF5]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
          {/* Breadcrumb & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              type="button"
              onClick={onBackToStorefront}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#157A28] hover:text-[#0E511B] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Beranda
            </button>

            <div className="flex items-center gap-4 text-xs text-[#525C53]">
              <span>Sinkronisasi Langsung CRM PT Hana Food Indonesia</span>
            </div>
          </div>

          {/* Search Header + Input Bar */}
          <div className="max-w-3xl space-y-4">
            <h1 className="font-display italic font-extrabold text-3xl sm:text-4xl lg:text-[42px] text-[#135E20] tracking-tight leading-tight text-balance">
              Lacak Pengiriman Pesanan Umi Hana
            </h1>
            <p className="text-sm sm:text-base text-[#4B5847] leading-relaxed">
              Masukkan nomor pesanan dari struk pembayaran atau WhatsApp resmi kami untuk memantau tahap pengemasan, kurir pengiriman, serta pembaruan status dari sistem CRM secara real-time.
            </p>

            <form onSubmit={handleSubmit} className="pt-1 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search
                    className="w-4 h-4 text-[#6B7A6D] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    aria-label="Nomor Pesanan"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Masukkan nomor pesanan (contoh: UH-2026-1040)"
                    className="w-full pl-11 pr-10 py-3.5 text-sm sm:text-base font-mono-tabular uppercase bg-white border border-[#D4CAA8] rounded-xl text-[#141A15] placeholder:normal-case placeholder:font-sans placeholder:text-[#7A847B] focus:outline-none focus:border-[#177A28] focus:ring-2 focus:ring-[#177A28]/15"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        setErrorMsg(null);
                      }}
                      aria-label="Hapus input nomor pesanan"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#7A847B] hover:text-[#141A15] rounded-md cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-7 py-3.5 text-sm font-bold text-white bg-[#177A28] hover:bg-[#11601E] disabled:opacity-60 rounded-xl shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {loading ? 'Mencari Data...' : 'Lacak Pesanan'}
                </button>
              </div>

              {/* Quick Sample Codes from Live CRM */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#4B5847] pt-1">
                <span className="font-medium text-[#525C53]">Contoh kode pesanan CRM:</span>
                {sampleList.map((sample) => (
                  <button
                    key={sample.code}
                    type="button"
                    onClick={() => void runLookup(sample.code)}
                    className={`inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                      result?.orderCode === sample.code
                        ? 'text-[#135E20] font-bold underline underline-offset-4'
                        : 'text-[#157A28] hover:text-[#0E511B]'
                    }`}
                  >
                    <span className="font-mono-tabular font-semibold">{sample.code}</span>
                    <span className="text-[#6B7A6D]">({sample.statusHint})</span>
                  </button>
                ))}
              </div>
            </form>

            {errorMsg && (
              <div
                role="alert"
                className="px-4 py-3 text-sm text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-xl"
              >
                {errorMsg}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Result Area */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {!result ? (
          <div className="bg-white border border-[#EAE0C1] rounded-2xl p-8 sm:p-12 shadow-[0_8px_24px_rgba(74,37,17,0.04)] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#EAF7E4] flex items-center justify-center text-[#177A28]">
                <Truck className="w-6 h-6" />
              </div>
              <h2 className="font-display text-2xl font-bold text-[#141A15]">
                Siap memantau paket Kripik Tempe Anda
              </h2>
              <p className="text-sm sm:text-base text-[#4B5847] leading-relaxed max-w-xl">
                Setiap perubahan status pembayaran, pengemasan di gudang, hingga pengiriman kurir yang diperbarui tim kami di Dashboard CRM akan langsung terlihat di halaman ini.
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-[#525C53]">
                <span>Format kode: <strong className="font-mono-tabular text-[#141A15]">UH-2026-XXXX</strong></span>
                <span aria-hidden="true">·</span>
                <span>Privasi data penerima terjaga</span>
                <span aria-hidden="true">·</span>
                <span>Pembaruan otomatis via WhatsApp</span>
              </div>
            </div>

            <div className="lg:col-span-5 bg-[#FCFDF9] border border-[#E4E7DF] rounded-xl p-5 space-y-3">
              <div className="text-sm font-semibold text-[#141A15]">
                Belum punya nomor pesanan?
              </div>
              <p className="text-xs text-[#525C53] leading-relaxed">
                Pesan paket Umi Hana Kripik Tempe Rasa Original sekarang atau hubungi admin WhatsApp jika kode pesanan pada struk Anda tidak ditemukan.
              </p>
              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onQuickOrder}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#177A28] hover:bg-[#11601E] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Pesan Paket Sekarang
                </button>
                <a
                  href={waSupportHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    void trackAnalyticsEvent('whatsapp_click', 'Dedicated Tracking — Bantuan Cari Kode')
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-[#141A15] bg-white border border-[#D4D9CD] hover:bg-[#F7F8F5] rounded-lg transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#177A28]" />
                  Tanya Admin WA
                </a>
              </div>
            </div>
          </div>
        ) : (
          <motion.div
            key={result.orderCode}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            {/* Status Overview & 4-Step Progress Card */}
            <div className="bg-white border border-[#EAE0C1] rounded-2xl p-6 sm:p-8 shadow-[0_8px_24px_rgba(74,37,17,0.05)] space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-[#E4E7DF]">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#525C53] font-mono-tabular">
                    <span className="font-semibold text-[#141A15]">{result.orderCode}</span>
                    <span aria-hidden="true">·</span>
                    <span>Dipesan {formatDateTime(result.createdAt)}</span>
                    {lastCheckedAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Dicek {formatDateTime(lastCheckedAt)}</span>
                      </>
                    )}
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141A15]">
                    {DELIVERY_STEPS[activeStepIndex]?.label ?? 'Status Pesanan'}
                  </h2>
                  <p className="text-sm text-[#4B5847]">
                    {result.estimatedDeliveryLabel}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-left sm:text-right mr-2">
                    <div className="text-xs text-[#525C53]">Status Pembayaran</div>
                    <div
                      className={`text-sm font-bold mt-0.5 ${
                        result.paymentStatus === 'lunas'
                          ? 'text-[#1B6B3A]'
                          : result.paymentStatus === 'cod_diproses'
                            ? 'text-[#0F766E]'
                            : 'text-[#B45309]'
                      }`}
                    >
                      {PAYMENT_STATUS_LABELS[result.paymentStatus]}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runLookup(result.orderCode, true)}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#141A15] bg-[#FAF9F2] hover:bg-[#F1EEE0] border border-[#DCD6BE] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    Perbarui Status
                  </button>
                </div>
              </div>

              {/* Linear Progress Indicator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#525C53]">
                  <span>Progres Pengiriman</span>
                  <span className="font-mono-tabular font-semibold text-[#135E20]">
                    Tahap {activeStepIndex + 1} dari {DELIVERY_STEPS.length} ({progressPercentage}%)
                  </span>
                </div>
                <div className="h-2 bg-[#EEF2EB] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#177A28] rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              {/* 4-Step Delivery Grid */}
              <ol
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"
                aria-label="Tahapan Pengiriman Pesanan"
              >
                {DELIVERY_STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const isCompleted = index < activeStepIndex;
                  const isCurrent = index === activeStepIndex;
                  return (
                    <li
                      key={step.key}
                      className={`rounded-xl p-4 border transition-colors ${
                        isCurrent
                          ? 'bg-[#F4FAF4] border-[#177A28]'
                          : isCompleted
                            ? 'bg-[#FAFDF9] border-[#C6DFCE]'
                            : 'bg-white border-[#E4E7DF]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`font-mono-tabular text-xs font-semibold ${
                            isCurrent || isCompleted ? 'text-[#157A28]' : 'text-[#7A847B]'
                          }`}
                        >
                          0{index + 1}
                        </span>
                        <span
                          className={`w-7 h-7 rounded-lg inline-flex items-center justify-center ${
                            isCurrent
                              ? 'bg-[#177A28] text-white'
                              : isCompleted
                                ? 'bg-[#E3F3E7] text-[#157A28]'
                                : 'bg-[#F5F6F2] text-[#8E988F]'
                          }`}
                        >
                          {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                        </span>
                      </div>
                      <div
                        className={`text-sm font-bold mt-3 ${
                          isCurrent || isCompleted ? 'text-[#141A15]' : 'text-[#7A847B]'
                        }`}
                      >
                        {step.label}
                      </div>
                      <p className="text-xs text-[#525C53] mt-1 leading-snug">{step.description}</p>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Bottom 2-Column Detail Grid: Timeline + CRM Order Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Live Milestone Timeline */}
              <div className="lg:col-span-7 bg-white border border-[#EAE0C1] rounded-2xl p-6 sm:p-7 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-[#141A15]">
                    Linimasa Pengiriman &amp; Aktivitas CRM
                  </h3>
                  <p className="text-xs text-[#525C53] mt-0.5">
                    Riwayat pembaruan pesanan yang tersinkronisasi langsung dengan sistem CRM PT Hana Food Indonesia.
                  </p>
                </div>

                <ol className="space-y-4">
                  {result.milestones.map((item, idx) => {
                    const isLast = idx === result.milestones.length - 1;
                    return (
                      <li key={item.id} className="relative flex gap-4">
                        <div className="flex flex-col items-center">
                          <span
                            className={`w-6 h-6 rounded-full inline-flex items-center justify-center shrink-0 border ${
                              item.status === 'completed'
                                ? 'bg-[#177A28] border-[#177A28] text-white'
                                : item.status === 'current'
                                  ? 'bg-[#EAF7E4] border-[#177A28] text-[#177A28]'
                                  : 'bg-white border-[#D4D9CD] text-[#9AA39B]'
                            }`}
                          >
                            {item.status === 'completed' ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <span className="font-mono-tabular text-[11px] font-bold">
                                {idx + 1}
                              </span>
                            )}
                          </span>
                          {!isLast && (
                            <span
                              aria-hidden="true"
                              className={`w-px flex-1 my-1 ${
                                item.status === 'completed' ? 'bg-[#94C9A1]' : 'bg-[#E4E7DF]'
                              }`}
                            />
                          )}
                        </div>

                        <div className={`pb-3 min-w-0 flex-1 ${isLast ? 'pb-0' : ''}`}>
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <div
                              className={`text-sm font-semibold ${
                                item.status === 'upcoming' ? 'text-[#7A847B]' : 'text-[#141A15]'
                              }`}
                            >
                              {item.title}
                            </div>
                            <div className="text-xs font-mono-tabular text-[#6B7A6D]">
                              {item.timestamp ? formatDateTime(item.timestamp) : 'Menunggu tahap sebelumnya'}
                            </div>
                          </div>
                          <p className="text-xs text-[#525C53] mt-1 leading-relaxed">{item.detail}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Right: Order & CRM Metadata Summary */}
              <div className="lg:col-span-5 bg-white border border-[#EAE0C1] rounded-2xl p-6 sm:p-7 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-[#141A15]">
                    Ringkasan Pesanan &amp; Data CRM
                  </h3>
                  <p className="text-xs text-[#525C53] mt-0.5">
                    Data sensitif pelanggan disamarkan untuk melindungi privasi Anda.
                  </p>
                </div>

                <dl className="divide-y divide-[#ECEFE8] text-sm">
                  <div className="py-3 flex justify-between gap-4">
                    <dt className="text-[#525C53]">Penerima &amp; Kota</dt>
                    <dd className="font-semibold text-[#141A15] text-right">
                      {result.recipientLabel} · {result.city}
                    </dd>
                  </div>
                  <div className="py-3 flex justify-between gap-4">
                    <dt className="text-[#525C53]">Paket Produk</dt>
                    <dd className="font-medium text-[#141A15] text-right">
                      {result.packageName} × {result.quantity}
                    </dd>
                  </div>
                  <div className="py-3 flex justify-between gap-4">
                    <dt className="text-[#525C53]">Layanan Kurir</dt>
                    <dd className="text-[#141A15] text-right">
                      {result.shippingMethod === 'kilat' ? 'Kurir Kilat (1 Hari)' : 'Kurir Reguler (2–3 Hari)'}
                    </dd>
                  </div>
                  <div className="py-3 flex justify-between gap-4">
                    <dt className="text-[#525C53]">Metode Pembayaran</dt>
                    <dd className="text-[#141A15] text-right">{result.paymentLabel}</dd>
                  </div>
                  <div className="py-3 flex justify-between gap-4">
                    <dt className="text-[#525C53]">Total Transaksi</dt>
                    <dd className="font-mono-tabular font-bold text-[#141A15]">
                      {formatRupiah(result.totalAmount)}
                    </dd>
                  </div>
                  <div className="py-3 flex justify-between gap-4">
                    <dt className="text-[#525C53]">Tahap CRM</dt>
                    <dd className="text-right">
                      <span className="font-semibold text-[#157A28]">
                        {result.crmStage ? CRM_STAGE_LABELS[result.crmStage] : 'Tercatat di Sistem'}
                      </span>
                      {result.crmUpdatedAt && (
                        <span className="block text-[11px] text-[#6B7A6D] font-mono-tabular mt-0.5">
                          Update {formatDateTime(result.crmUpdatedAt)}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="py-3 flex justify-between gap-4">
                    <dt className="text-[#525C53]">Notifikasi WhatsApp</dt>
                    <dd className="text-right text-[#141A15] font-mono-tabular">
                      {result.crmFollowUpCount > 0
                        ? `${result.crmFollowUpCount} pesan terkirim`
                        : 'Siap otomatis saat status berubah'}
                    </dd>
                  </div>
                </dl>

                <div className="pt-2 border-t border-[#ECEFE8] space-y-2.5">
                  <a
                    href={waSupportHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      void trackAnalyticsEvent('whatsapp_click', `Dedicated Tracking Help ${result.orderCode}`)
                    }
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-[#1D8F44] hover:bg-[#167336] rounded-xl transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Hubungi CS WhatsApp ({BRAND_INFO.whatsappDisplay})
                  </a>
                  <button
                    type="button"
                    onClick={onQuickOrder}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#141A15] bg-[#FAF9F2] hover:bg-[#F1EEE0] border border-[#DCD6BE] rounded-xl transition-colors cursor-pointer"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 text-[#177A28]" />
                    Pesan Ulang Kripik Tempe Umi Hana
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </section>
    </main>
  );
}
