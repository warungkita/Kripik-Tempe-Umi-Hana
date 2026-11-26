import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  CreditCard,
  MessageCircle,
  Minus,
  Plus,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react';
import {
  BRAND_INFO,
  PAYMENT_METHODS,
  PRODUCT_PACKAGES,
  formatRupiah,
  getPackageById,
} from '../data/catalog.ts';
import {
  confirmOrderPayment,
  createOrder,
  submitLead,
  trackAnalyticsEvent,
} from '../lib/api.ts';
import type { OrderRecord, PackageId, PaymentMethodId, ShippingMethodId } from '../types.ts';

interface CheckoutModalProps {
  isOpen: boolean;
  initialPackageId: PackageId;
  onClose: () => void;
  onOrderCompleted: (order: OrderRecord) => void;
  onTrackOrder?: (orderCode: string) => void;
  onNotify: (message: string) => void;
}

function DeterministicQrisSvg({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    const grid: boolean[] = [];
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const size = 21;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const inTopLeft = r < 7 && c < 7;
        const inTopRight = r < 7 && c >= size - 7;
        const inBottomLeft = r >= size - 7 && c < 7;
        if (inTopLeft || inTopRight || inBottomLeft) {
          const lr = inBottomLeft ? r - (size - 7) : r;
          const lc = inTopRight ? c - (size - 7) : c;
          const isFinderBorder = lr === 0 || lr === 6 || lc === 0 || lc === 6;
          const isFinderCore = lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4;
          grid.push(isFinderBorder || isFinderCore);
        } else {
          hash ^= r * 31 + c * 17;
          hash = Math.imul(hash, 16777619);
          grid.push((Math.abs(hash) % 10) < 5);
        }
      }
    }
    return grid;
  }, [seed]);

  return (
    <svg
      viewBox="0 0 21 21"
      className="w-40 h-40 mx-auto border border-[#E4E7DF] bg-white p-2 rounded-lg"
      role="img"
      aria-label={`Kode QRIS untuk pesanan ${seed}`}
    >
      {cells.map((filled, index) => {
        if (!filled) return null;
        const x = index % 21;
        const y = Math.floor(index / 21);
        return <rect key={index} x={x} y={y} width="1" height="1" fill="#141A15" />;
      })}
    </svg>
  );
}

export function CheckoutModal({
  isOpen,
  initialPackageId,
  onClose,
  onOrderCompleted,
  onTrackOrder,
  onNotify,
}: CheckoutModalProps) {
  const [packageId, setPackageId] = useState<PackageId>(initialPackageId);
  const [quantity, setQuantity] = useState(1);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodId>('reguler');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>('qris');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [step, setStep] = useState<'form' | 'payment' | 'receipt'>('form');
  const [activeOrder, setActiveOrder] = useState<OrderRecord | null>(null);
  const [activeCheckoutToken, setActiveCheckoutToken] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [abandonedSaved, setAbandonedSaved] = useState(false);

  // Sync package when modal re-opens with a different bundle
  const [lastInitialPkg, setLastInitialPkg] = useState<PackageId>(initialPackageId);
  if (initialPackageId !== lastInitialPkg) {
    setLastInitialPkg(initialPackageId);
    setPackageId(initialPackageId);
    setQuantity(1);
    setStep('form');
    setActiveOrder(null);
    setErrorMsg(null);
    setAbandonedSaved(false);
  }

  if (!isOpen) return null;

  const selectedPkg = getPackageById(packageId);
  const subtotal = selectedPkg.price * quantity;
  const shippingFee =
    shippingMethod === 'kilat' ? 22000 : selectedPkg.freeShipping || subtotal >= 84000 ? 0 : 12000;
  const totalAmount = subtotal + shippingFee;

  const captureAbandonedLeadIfEligible = async () => {
    if (abandonedSaved || step === 'receipt') return;
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    if (customerName.trim().length >= 2 && cleanPhone.length >= 10) {
      setAbandonedSaved(true);
      try {
        await submitLead({
          name: customerName.trim(),
          phone: customerPhone.trim(),
          email: customerEmail.trim(),
          city: city.trim() || 'Indonesia',
          source: 'Checkout Tertunda',
          packageInterest: `${selectedPkg.name} × ${quantity}`,
          estimatedValue: totalAmount,
          notes:
            step === 'payment' && activeOrder
              ? `Menutup halaman pembayaran ${activeOrder.orderCode} (${activeOrder.paymentLabel}).`
              : 'Mengisi data pengiriman namun belum melanjutkan ke pembayaran.',
        });
      } catch {
        // Silent background capture
      }
    }
  };

  const handleClose = () => {
    void captureAbandonedLeadIfEligible();
    onClose();
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (customerName.trim().length < 2) {
      setErrorMsg('Mohon masukkan nama lengkap penerima.');
      return;
    }
    if (customerPhone.replace(/[^0-9]/g, '').length < 10) {
      setErrorMsg('Masukkan nomor WhatsApp aktif minimal 10 digit (contoh: 081234567890).');
      return;
    }
    if (address.trim().length < 8 || city.trim().length < 2) {
      setErrorMsg('Mohon lengkapi alamat pengiriman dan kota tujuan.');
      return;
    }

    setSubmitting(true);
    try {
      const { order, checkoutToken } = await createOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        address: address.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        packageId,
        quantity,
        shippingMethod,
        paymentMethod,
      });

      setActiveOrder(order);
      setActiveCheckoutToken(checkoutToken);
      if (order.paymentMethod === 'cod') {
        setStep('receipt');
        onOrderCompleted(order);
        onNotify(`Pesanan COD ${order.orderCode} berhasil dikonfirmasi.`);
      } else {
        setStep('payment');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kendala saat membuat pesanan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!activeOrder) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { order } = await confirmOrderPayment(activeOrder.orderCode, activeCheckoutToken);
      setActiveOrder(order);
      setStep('receipt');
      onOrderCompleted(order);
      onNotify(`Pembayaran ${order.orderCode} terverifikasi lunas.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memverifikasi pembayaran.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      onNotify('Salin kode secara manual dari layar.');
    }
  };

  const receiptWhatsAppHref = activeOrder
    ? `https://wa.me/${BRAND_INFO.whatsappNormalized}?text=${encodeURIComponent(
        `Halo Umi Hana, saya baru saja menyelesaikan pesanan ${activeOrder.orderCode} (${activeOrder.packageName} × ${activeOrder.quantity}, Total ${formatRupiah(activeOrder.totalAmount)}, Metode: ${activeOrder.paymentLabel}). Mohon info nomor resi pengirimannya ya.`
      )}`
    : '#';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#141A15]/55 backdrop-blur-[2px] p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl border border-[#E4E7DF] shadow-xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E7DF] bg-[#F7F8F5]">
          <div>
            <h2 id="checkout-modal-title" className="font-display text-xl font-bold text-[#141A15]">
              {step === 'form' && 'Checkout Cepat Umi Hana'}
              {step === 'payment' && 'Selesaikan Pembayaran'}
              {step === 'receipt' && 'Pesanan Terkonfirmasi'}
            </h2>
            <p className="text-xs text-[#525C53] mt-0.5">
              {step === 'form' && 'Langkah 1 dari 2 · Pengiriman & Metode Pembayaran'}
              {step === 'payment' && `Langkah 2 dari 2 · Kode Pesanan ${activeOrder?.orderCode}`}
              {step === 'receipt' && 'Struk resmi PT Hana Food Indonesia'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup jendela checkout"
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#525C53] hover:text-[#141A15] hover:bg-white border border-transparent hover:border-[#E4E7DF] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div
              role="alert"
              className="px-4 py-3 text-sm text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-lg"
            >
              {errorMsg}
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={handleCreateOrder} className="space-y-6">
              {/* Package selector & quantity */}
              <div className="bg-[#F7F8F5] border border-[#E4E7DF] rounded-xl p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label htmlFor="checkout-pkg" className="block text-xs font-medium text-[#525C53] mb-1">
                      Pilihan Paket Kripik Tempe Original (60 g / pouch)
                    </label>
                    <select
                      id="checkout-pkg"
                      value={packageId}
                      onChange={(e) => setPackageId(e.target.value as PackageId)}
                      className="w-full sm:w-auto px-3 py-2 text-sm font-semibold text-[#141A15] bg-white border border-[#D4D9CD] rounded-lg focus:outline-none focus:border-[#1B6B3A]"
                    >
                      {PRODUCT_PACKAGES.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} ({pkg.packCount} bks) — {formatRupiah(pkg.price)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="text-xs text-[#525C53]">Jumlah Paket</span>
                    <div className="inline-flex items-center border border-[#D4D9CD] rounded-lg bg-white">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        aria-label="Kurangi jumlah"
                        className="w-9 h-9 inline-flex items-center justify-center text-[#141A15] hover:bg-[#F7F8F5] rounded-l-lg cursor-pointer"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-10 text-center text-sm font-mono-tabular font-semibold">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(30, q + 1))}
                        aria-label="Tambah jumlah"
                        className="w-9 h-9 inline-flex items-center justify-center text-[#141A15] hover:bg-[#F7F8F5] rounded-r-lg cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E4E7DF] grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => setShippingMethod('reguler')}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      shippingMethod === 'reguler'
                        ? 'border-[#1B6B3A] bg-white text-[#141A15]'
                        : 'border-[#E4E7DF] bg-transparent text-[#525C53] hover:bg-white'
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Truck className="w-4 h-4 text-[#1B6B3A]" />
                      Reguler (2–3 Hari)
                    </span>
                    <span className="font-mono-tabular text-xs font-semibold text-[#1B6B3A]">
                      {selectedPkg.freeShipping || subtotal >= 84000 ? 'Gratis' : formatRupiah(12000)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShippingMethod('kilat')}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      shippingMethod === 'kilat'
                        ? 'border-[#1B6B3A] bg-white text-[#141A15]'
                        : 'border-[#E4E7DF] bg-transparent text-[#525C53] hover:bg-white'
                    }`}
                  >
                    <span className="font-medium">Kilat (1 Hari Tiba)</span>
                    <span className="font-mono-tabular text-xs font-semibold text-[#141A15]">
                      {formatRupiah(22000)}
                    </span>
                  </button>
                </div>
              </div>

              {/* Delivery details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-[#141A15]">Data Penerima &amp; Alamat</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="chk-name" className="block text-xs font-medium text-[#525C53] mb-1">
                      Nama Lengkap *
                    </label>
                    <input
                      id="chk-name"
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Contoh: Rina Kartika"
                      className="w-full px-3.5 py-2.5 text-sm border border-[#D4D9CD] rounded-lg focus:outline-none focus:border-[#1B6B3A]"
                    />
                  </div>
                  <div>
                    <label htmlFor="chk-phone" className="block text-xs font-medium text-[#525C53] mb-1">
                      Nomor WhatsApp Aktif *
                    </label>
                    <input
                      id="chk-phone"
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full px-3.5 py-2.5 text-sm border border-[#D4D9CD] rounded-lg focus:outline-none focus:border-[#1B6B3A]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="chk-city" className="block text-xs font-medium text-[#525C53] mb-1">
                      Kota / Kabupaten *
                    </label>
                    <input
                      id="chk-city"
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Contoh: Bandung"
                      className="w-full px-3.5 py-2.5 text-sm border border-[#D4D9CD] rounded-lg focus:outline-none focus:border-[#1B6B3A]"
                    />
                  </div>
                  <div>
                    <label htmlFor="chk-postal" className="block text-xs font-medium text-[#525C53] mb-1">
                      Kode Pos
                    </label>
                    <input
                      id="chk-postal"
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="40135"
                      className="w-full px-3.5 py-2.5 text-sm border border-[#D4D9CD] rounded-lg focus:outline-none focus:border-[#1B6B3A]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="chk-address" className="block text-xs font-medium text-[#525C53] mb-1">
                    Alamat Lengkap Pengiriman *
                  </label>
                  <textarea
                    id="chk-address"
                    rows={2}
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Nama jalan, nomor rumah, RT/RW, kecamatan, patokan"
                    className="w-full px-3.5 py-2.5 text-sm border border-[#D4D9CD] rounded-lg focus:outline-none focus:border-[#1B6B3A]"
                  />
                </div>

                <div>
                  <label htmlFor="chk-email" className="block text-xs font-medium text-[#525C53] mb-1">
                    Email untuk Struk Digital (Opsional)
                  </label>
                  <input
                    id="chk-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full px-3.5 py-2.5 text-sm border border-[#D4D9CD] rounded-lg focus:outline-none focus:border-[#1B6B3A]"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#141A15] flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#1B6B3A]" />
                  Metode Pembayaran Terintegrasi
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {PAYMENT_METHODS.map((pm) => {
                    const active = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-[#1B6B3A] bg-[#F4F8F5]'
                            : 'border-[#E4E7DF] bg-white hover:bg-[#F7F8F5]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-[#141A15]">{pm.label}</span>
                          <span className="text-[11px] text-[#525C53]">{pm.category}</span>
                        </div>
                        <p className="text-xs text-[#525C53] mt-1 leading-relaxed">{pm.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Totals & Primary CTA */}
              <div className="border-t border-[#E4E7DF] pt-4 space-y-3">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-[#525C53]">
                    <span>
                      Subtotal ({selectedPkg.packCount * quantity} pouch × 60 g)
                    </span>
                    <span className="font-mono-tabular">{formatRupiah(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#525C53]">
                    <span>Ongkos Kirim ({shippingMethod === 'kilat' ? 'Kilat' : 'Reguler'})</span>
                    <span className="font-mono-tabular text-[#1B6B3A] font-medium">
                      {shippingFee === 0 ? 'Gratis Ongkir' : formatRupiah(shippingFee)}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-[#141A15] pt-2 border-t border-[#E4E7DF]">
                    <span>Total Pembayaran</span>
                    <span className="font-mono-tabular">{formatRupiah(totalAmount)}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-6 py-3.5 text-sm font-semibold text-white bg-[#1B6B3A] hover:bg-[#14532D] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                  >
                    {submitting
                      ? 'Memproses Pesanan...'
                      : paymentMethod === 'cod'
                        ? `Konfirmasi Pesanan COD — ${formatRupiah(totalAmount)}`
                        : `Lanjutkan ke Pembayaran — ${formatRupiah(totalAmount)}`}
                  </button>
                </div>

                <p className="text-xs text-[#525C53] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#1B6B3A] shrink-0" />
                  Garansi ganti baru 100% jika kemasan tiba dalam kondisi rusak atau melempem.
                </p>
              </div>
            </form>
          )}

          {step === 'payment' && activeOrder && (
            <div className="space-y-6">
              <div className="bg-[#F7F8F5] border border-[#E4E7DF] rounded-xl p-5 text-center space-y-4">
                <div className="text-xs text-[#525C53]">
                  {activeOrder.paymentLabel} · PT Hana Food Indonesia
                </div>
                <div className="font-mono-tabular text-2xl font-bold text-[#141A15]">
                  {formatRupiah(activeOrder.totalAmount)}
                </div>

                {activeOrder.paymentMethod === 'qris' ? (
                  <div className="space-y-3">
                    <DeterministicQrisSvg seed={activeOrder.paymentCode} />
                    <p className="text-xs text-[#525C53] max-w-sm mx-auto">
                      Pindai kode QRIS di atas lewat aplikasi perbankan atau e-wallet Anda. Referensi transaksi:{' '}
                      <span className="font-mono-tabular font-semibold text-[#141A15]">
                        {activeOrder.paymentCode}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-[#E4E7DF] rounded-lg p-4 max-w-md mx-auto space-y-2">
                    <div className="text-xs text-[#525C53]">Nomor Virtual Account / Kode Bayar</div>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono-tabular text-lg font-bold text-[#141A15] tracking-wide">
                        {activeOrder.paymentCode}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyCode(activeOrder.paymentCode)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-[#D4D9CD] rounded-md hover:bg-[#F7F8F5] cursor-pointer"
                      >
                        {copiedCode ? <Check className="w-3.5 h-3.5 text-[#1B6B3A]" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedCode ? 'Tersalin' : 'Salin'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleVerifyPayment()}
                  className="w-full px-6 py-3.5 text-sm font-semibold text-white bg-[#1B6B3A] hover:bg-[#14532D] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  {submitting ? 'Memverifikasi Pembayaran...' : 'Saya Sudah Bayar — Verifikasi Otomatis'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full px-6 py-3 text-sm font-medium text-[#525C53] hover:text-[#141A15] border border-[#E4E7DF] rounded-lg transition-colors cursor-pointer"
                >
                  Bayar Nanti (Kirim Pengingat Otomatis ke WhatsApp Saya)
                </button>
              </div>
            </div>
          )}

          {step === 'receipt' && activeOrder && (
            <div className="space-y-6">
              <div className="bg-[#F4F8F5] border border-[#C6DFCE] rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-[#1B6B3A] font-semibold text-sm">
                  <Check className="w-5 h-5" />
                  Pesanan #{activeOrder.orderCode} Terkonfirmasi — Sedang Dikemas
                </div>
                <p className="text-sm text-[#525C53]">
                  Terima kasih, {activeOrder.customerName}. Pesanan Anda telah masuk ke sistem pengemasan PT Hana Food Indonesia dan tercatat pada akun pelanggan kami.
                </p>
              </div>

              <div className="border border-[#E4E7DF] rounded-xl divide-y divide-[#E4E7DF] text-sm">
                <div className="px-4 py-3 flex justify-between gap-4">
                  <span className="text-[#525C53]">Nomor Pesanan</span>
                  <span className="font-mono-tabular font-semibold text-[#141A15]">{activeOrder.orderCode}</span>
                </div>
                <div className="px-4 py-3 flex justify-between gap-4">
                  <span className="text-[#525C53]">Produk</span>
                  <span className="font-medium text-[#141A15] text-right">
                    {activeOrder.packageName} × {activeOrder.quantity}
                  </span>
                </div>
                <div className="px-4 py-3 flex justify-between gap-4">
                  <span className="text-[#525C53]">Metode Pembayaran</span>
                  <span className="font-medium text-[#141A15]">{activeOrder.paymentLabel}</span>
                </div>
                <div className="px-4 py-3 flex justify-between gap-4">
                  <span className="text-[#525C53]">Status</span>
                  <span className="font-semibold text-[#1B6B3A]">
                    {activeOrder.paymentStatus === 'cod_diproses' ? 'COD Diproses · Siap Dikirim' : 'Lunas · Sedang Dikemas'}
                  </span>
                </div>
                <div className="px-4 py-3 flex justify-between gap-4">
                  <span className="text-[#525C53]">Tujuan Pengiriman</span>
                  <span className="text-[#141A15] text-right max-w-xs">
                    {activeOrder.address}, {activeOrder.city} {activeOrder.postalCode}
                  </span>
                </div>
                <div className="px-4 py-3 flex justify-between gap-4 bg-[#F7F8F5] font-bold">
                  <span className="text-[#141A15]">Total</span>
                  <span className="font-mono-tabular text-[#141A15]">
                    {formatRupiah(activeOrder.totalAmount)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={receiptWhatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void trackAnalyticsEvent('whatsapp_click', `Struk ${activeOrder.orderCode}`)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#1B6B3A] hover:bg-[#14532D] rounded-lg transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Kirim Struk via WhatsApp
                </a>
                {onTrackOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      const code = activeOrder.orderCode;
                      handleClose();
                      onTrackOrder(code);
                    }}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[#141A15] bg-[#FAF9F2] hover:bg-[#F1EEE0] border border-[#DCD6BE] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Truck className="w-4 h-4 text-[#1B6B3A]" />
                    Lacak Pengiriman
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-3 text-sm font-medium text-[#141A15] border border-[#E4E7DF] hover:bg-[#F7F8F5] rounded-lg transition-colors cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
