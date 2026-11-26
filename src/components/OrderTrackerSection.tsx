import { useEffect, useState } from 'react';
import { ArrowRight, Check, MessageCircle, PackageCheck, Search, Truck } from 'lucide-react';
import { BRAND_INFO, formatRupiah } from '../data/catalog.ts';
import { trackAnalyticsEvent, trackOrderByCode } from '../lib/api.ts';
import type { CrmStage, OrderRecord, OrderTrackingResult } from '../types.ts';

interface OrderTrackerSectionProps {
  recentOrderCode?: string | null;
  onOpenDedicatedTracking?: (orderCode?: string) => void;
}

const DELIVERY_STEPS: Array<{
  key: OrderRecord['fulfillmentStatus'];
  label: string;
  description: string;
}> = [
  {
    key: 'menunggu_bayar',
    label: 'Pesanan Masuk',
    description: 'Menunggu verifikasi pembayaran',
  },
  {
    key: 'dikemas',
    label: 'Sedang Dikemas',
    description: 'Diproses higienis di gudang PT Hana Food',
  },
  {
    key: 'dikirim',
    label: 'Dalam Pengiriman',
    description: 'Paket sedang menuju kota tujuan',
  },
  {
    key: 'selesai',
    label: 'Pesanan Tiba',
    description: 'Diterima dengan baik oleh pelanggan',
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
  follow_up_wa: 'Dalam Tindak Lanjut WhatsApp',
  pelanggan_setia: 'Pelanggan Setia Terverifikasi',
  tidak_aktif: 'Arsip',
};

const SAMPLE_CODES = ['UH-2026-1040', 'UH-2026-1041', 'UH-2026-1039', 'UH-2026-1042'];

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

export function OrderTrackerSection({
  recentOrderCode,
  onOpenDedicatedTracking,
}: OrderTrackerSectionProps) {
  const [query, setQuery] = useState(recentOrderCode ?? '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<OrderTrackingResult | null>(null);

  const runLookup = async (codeToLookup: string) => {
    const cleaned = codeToLookup.trim().toUpperCase();
    if (!cleaned) {
      setErrorMsg('Masukkan kode pesanan Anda (contoh: UH-2026-1040).');
      return;
    }
    setQuery(cleaned);
    setLoading(true);
    setErrorMsg(null);
    try {
      const tracking = await trackOrderByCode(cleaned);
      setResult(tracking);
    } catch (err) {
      setResult(null);
      setErrorMsg(err instanceof Error ? err.message : 'Pesanan tidak ditemukan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (recentOrderCode) {
      setQuery(recentOrderCode);
      void runLookup(recentOrderCode);
    }
  }, [recentOrderCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runLookup(query);
  };

  const activeStepIndex = result
    ? DELIVERY_STEPS.findIndex((step) => step.key === result.fulfillmentStatus)
    : -1;

  const waSupportHref = result
    ? `https://wa.me/${BRAND_INFO.whatsappNormalized}?text=${encodeURIComponent(
        `Halo Umi Hana, saya ingin menanyakan detail pengiriman untuk pesanan ${result.orderCode} tujuan ${result.city}.`
      )}`
    : '#';

  return (
    <section
      id="lacak-pesanan"
      className="bg-[#FFFDF5] border-t border-[#ECE2C3] py-16 lg:py-20"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Header & Search Form */}
          <div className="lg:col-span-5 space-y-5">
            <div>
              <p className="text-xs font-extrabold text-[#157A28] mb-2">
                Pelacakan Pengiriman Real-Time
              </p>
              <h2 className="font-display italic font-extrabold text-3xl sm:text-4xl text-[#135E20] tracking-tight">
                Lacak status pesanan Anda kapan saja.
              </h2>
            </div>

            <p className="text-sm sm:text-base text-[#4B5847] leading-relaxed">
              Masukkan kode pesanan dari struk checkout atau pesan WhatsApp untuk melihat tahap pengemasan dan pengiriman terbaru langsung dari sistem CRM Umi Hana.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#7A847B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    aria-label="Kode Pesanan"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Contoh: UH-2026-1040"
                    className="w-full pl-10 pr-3.5 py-3 text-sm font-mono-tabular uppercase bg-white border border-[#DCD2B2] rounded-full focus:outline-none focus:border-[#177A28]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 text-sm font-bold text-white bg-[#177A28] hover:bg-[#11601E] disabled:opacity-60 rounded-full shadow-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {loading ? 'Mencari...' : 'Lacak Pesanan'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#4B5847]">
                <span>Coba kode contoh:</span>
                {(recentOrderCode ? [recentOrderCode, ...SAMPLE_CODES.filter((c) => c !== recentOrderCode).slice(0, 3)] : SAMPLE_CODES).map(
                  (sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => void runLookup(sample)}
                      className="font-mono-tabular font-semibold text-[#157A28] hover:text-[#0E511B] underline underline-offset-4 cursor-pointer"
                    >
                      {sample}
                    </button>
                  )
                )}
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

          {/* Right Delivery Status Card */}
          <div className="lg:col-span-7">
            {!result ? (
              <div className="bg-white border border-[#EAE0C1] rounded-2xl p-8 sm:p-10 shadow-[0_8px_24px_rgba(74,37,17,0.05)] flex flex-col justify-center min-h-[280px] space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#EAF7E4] flex items-center justify-center text-[#177A28]">
                  <Truck className="w-6 h-6" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-base font-bold text-[#1C2A1A]">
                    Status pengiriman tampil otomatis di sini
                  </h3>
                  <p className="text-sm text-[#4B5847] leading-relaxed">
                    Ketik nomor pesanan Anda (format <span className="font-mono-tabular font-semibold text-[#135E20]">UH-2026-XXXX</span>) atau pilih salah satu kode contoh di samping untuk melihat status verifikasi pembayaran, pengemasan, dan pengiriman.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-[#EAE0C1] rounded-2xl p-6 sm:p-8 shadow-[0_8px_24px_rgba(74,37,17,0.06)] space-y-6">
                {/* Summary Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#E4E7DF]">
                  <div>
                    <div className="text-xs text-[#525C53] font-mono-tabular">
                      Kode Pesanan {result.orderCode} · Dibuat {formatDateTime(result.createdAt)}
                    </div>
                    <h3 className="font-display text-2xl font-bold text-[#141A15] mt-1">
                      {DELIVERY_STEPS[activeStepIndex]?.label ?? 'Status Pesanan'}
                    </h3>
                    <p className="text-xs text-[#525C53] mt-1">
                      {result.estimatedDeliveryLabel}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <div className="text-xs text-[#525C53]">Pembayaran</div>
                    <div
                      className={`text-sm font-semibold mt-0.5 ${
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
                </div>

                {/* 4-Step Delivery Timeline */}
                <ol className="grid grid-cols-1 sm:grid-cols-4 gap-3" aria-label="Tahapan Pengiriman">
                  {DELIVERY_STEPS.map((step, index) => {
                    const isCompleted = index < activeStepIndex;
                    const isCurrent = index === activeStepIndex;
                    return (
                      <li
                        key={step.key}
                        className={`rounded-xl p-3.5 border transition-colors ${
                          isCurrent
                            ? 'bg-white border-[#1B6B3A]'
                            : isCompleted
                              ? 'bg-[#F4F8F5] border-[#C6DFCE]'
                              : 'bg-white/60 border-[#E4E7DF]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`font-mono-tabular text-xs font-semibold ${
                              isCurrent || isCompleted ? 'text-[#1B6B3A]' : 'text-[#7A847B]'
                            }`}
                          >
                            0{index + 1}
                          </span>
                          {(isCompleted || isCurrent) && (
                            <span
                              className={`w-5 h-5 rounded-full inline-flex items-center justify-center ${
                                isCurrent ? 'bg-[#1B6B3A] text-white' : 'bg-[#1B6B3A]/15 text-[#1B6B3A]'
                              }`}
                            >
                              {isCurrent && step.key === 'selesai' ? (
                                <PackageCheck className="w-3 h-3" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                            </span>
                          )}
                        </div>
                        <div
                          className={`text-xs font-semibold mt-2 ${
                            isCurrent || isCompleted ? 'text-[#141A15]' : 'text-[#7A847B]'
                          }`}
                        >
                          {step.label}
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {/* Order & CRM Synced Details */}
                <div className="bg-white border border-[#E4E7DF] rounded-xl divide-y divide-[#E4E7DF] text-sm">
                  <div className="px-4 py-3 flex justify-between gap-4">
                    <span className="text-[#525C53]">Penerima &amp; Tujuan</span>
                    <span className="font-medium text-[#141A15] text-right">
                      {result.recipientLabel} · {result.city}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between gap-4">
                    <span className="text-[#525C53]">Paket Dipesan</span>
                    <span className="font-medium text-[#141A15] text-right">
                      {result.packageName} × {result.quantity}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between gap-4">
                    <span className="text-[#525C53]">Layanan &amp; Metode Bayar</span>
                    <span className="text-[#141A15] text-right">
                      {result.shippingMethod === 'kilat' ? 'Kurir Kilat (1 Hari)' : 'Kurir Reguler (2–3 Hari)'} ·{' '}
                      {result.paymentLabel}
                    </span>
                  </div>
                  <div className="px-4 py-3 flex justify-between gap-4">
                    <span className="text-[#525C53]">Total Transaksi</span>
                    <span className="font-mono-tabular font-semibold text-[#141A15]">
                      {formatRupiah(result.totalAmount)}
                    </span>
                  </div>
                  {result.crmStage && (
                    <div className="px-4 py-3 flex justify-between gap-4">
                      <span className="text-[#525C53]">Status Sinkronisasi CRM</span>
                      <span className="font-medium text-[#1B6B3A] text-right">
                        {CRM_STAGE_LABELS[result.crmStage]}
                        {result.crmUpdatedAt && (
                          <span className="block text-[11px] font-normal text-[#525C53] font-mono-tabular">
                            Diperbarui {formatDateTime(result.crmUpdatedAt)}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  {onOpenDedicatedTracking ? (
                    <button
                      type="button"
                      onClick={() => onOpenDedicatedTracking(result.orderCode)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#141A15] hover:text-[#157A28] underline underline-offset-4 cursor-pointer"
                    >
                      Lihat Linimasa CRM Lengkap
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-xs text-[#525C53]">
                      Butuh bantuan pengiriman atau ubah jadwal kurir?
                    </span>
                  )}
                  <a
                    href={waSupportHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      void trackAnalyticsEvent('whatsapp_click', `Track Order Help ${result.orderCode}`)
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B6B3A] hover:text-[#14532D] underline underline-offset-4"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Hubungi CS WhatsApp ({BRAND_INFO.whatsappDisplay})
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
