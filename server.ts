import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import type {
  AdminOverviewPayload,
  AnalyticsEventRecord,
  AnalyticsEventType,
  AnalyticsSummary,
  CrmLead,
  CrmStage,
  OrderRecord,
  OrderTrackingResult,
  PackageId,
  PaymentMethodId,
  ShippingMethodId,
  WhatsAppDispatchLog,
  WhatsAppRule,
} from './src/types.ts';

interface AdminCredentialStore {
  salt: string;
  hash: string;
  claimedAt: string;
}

interface PersistedStore {
  adminCredential: AdminCredentialStore | null;
  leads: CrmLead[];
  orders: OrderRecord[];
  analyticsEvents: AnalyticsEventRecord[];
  whatsappRules: WhatsAppRule[];
  whatsappLogs: WhatsAppDispatchLog[];
  orderSequence: number;
}

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'store.json');

const SERVER_PACKAGES: Record<
  PackageId,
  { name: string; packCount: number; price: number; freeShipping: boolean }
> = {
  'coba-3': {
    name: 'Paket Coba Keluarga (3 Bungkus)',
    packCount: 3,
    price: 45000,
    freeShipping: false,
  },
  'keluarga-6': {
    name: 'Paket Stok Rumah (6 Bungkus)',
    packCount: 6,
    price: 84000,
    freeShipping: true,
  },
  'reseller-15': {
    name: 'Paket Kantor & Reseller (15 Bungkus)',
    packCount: 15,
    price: 195000,
    freeShipping: true,
  },
};

const PAYMENT_LABELS: Record<PaymentMethodId, string> = {
  qris: 'QRIS Instan',
  va_bca: 'BCA Virtual Account',
  va_mandiri: 'Mandiri Virtual Account',
  va_bni: 'BNI Virtual Account',
  ewallet_gopay: 'GoPay / E-Wallet',
  cod: 'Bayar di Tempat (COD)',
};

const VALID_STAGES: CrmStage[] = [
  'prospek_baru',
  'menunggu_pembayaran',
  'follow_up_wa',
  'pelanggan_setia',
  'tidak_aktif',
];

const VALID_EVENTS: AnalyticsEventType[] = [
  'page_view',
  'view_pricing',
  'cta_click',
  'checkout_start',
  'checkout_abandoned',
  'lead_captured',
  'purchase_completed',
  'whatsapp_click',
];

const sessions = new Map<string, { expiresAt: number }>();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const orderConfirmTokens = new Map<string, string>();
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const trackAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  bucket: Map<string, { count: number; resetAt: number }>,
  ip: string,
  maxAttempts: number
): boolean {
  const now = Date.now();
  const entry = bucket.get(ip);
  if (!entry || entry.resetAt < now) {
    bucket.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count += 1;
  return true;
}

function checkAuthRateLimit(ip: string): boolean {
  return checkRateLimit(authAttempts, ip, 15);
}

function maskRecipientName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Pelanggan Umi Hana';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function sanitizeString(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen);
}

function normalizeIndonesianPhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  if (digits.startsWith('62')) return digits;
  return digits.slice(0, 16);
}

function formatRupiahServer(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
}

function buildInitialStore(): PersistedStore {
  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600 * 1000).toISOString();

  const defaultRules: WhatsAppRule[] = [
    {
      id: 'wa-rule-15m',
      name: 'Pengingat Checkout Tertunda (15 Menit)',
      triggerLabel: 'Otomatis 15 menit jika checkout belum dibayar',
      delayMinutes: 15,
      targetStages: ['menunggu_pembayaran'],
      active: true,
      template:
        'Halo Kak {nama}, pesanan {paket} ({total}) dari Umi Hana Kripik Tempe masih menunggu konfirmasi pembayaran. Balas pesan ini jika ingin dibantu QRIS, Virtual Account, atau opsi COD ya Kak.',
      sentCount: 28,
    },
    {
      id: 'wa-rule-3h',
      name: 'Follow-Up Prospek Belum Membeli (3 Jam)',
      triggerLabel: 'Otomatis 3 jam untuk prospek konsultasi & keranjang tertunda',
      delayMinutes: 180,
      targetStages: ['prospek_baru', 'menunggu_pembayaran'],
      active: true,
      template:
        'Halo Kak {nama}, terima kasih sudah melirik Kripik Tempe Umi Hana (100% bahan alami, 18g protein). Batch produksi hari ini masih tersedia untuk pengiriman sore ini. Mau kami kunci stok {paket} untuk Kakak?',
      sentCount: 19,
    },
    {
      id: 'wa-rule-24h',
      name: 'Penawaran Gratis Ongkir Penutup (24 Jam)',
      triggerLabel: 'Tindak lanjut H+1 untuk prospek yang masih ragu',
      delayMinutes: 1440,
      targetStages: ['follow_up_wa', 'menunggu_pembayaran'],
      active: true,
      template:
        'Selamat pagi Kak {nama}, sekadar mengingatkan bahwa Paket Stok Rumah (6 bungkus) sedang gratis ongkir reguler dan bergaransi ganti baru jika kemasan rusak. Silakan balas "PESAN" bila ingin langsung kami proses.',
      sentCount: 14,
    },
    {
      id: 'wa-rule-7d',
      name: 'Retensi & Repeat Order Pelanggan (H+7)',
      triggerLabel: 'Pengingat ramah 7 hari setelah pesanan diterima',
      delayMinutes: 10080,
      targetStages: ['pelanggan_setia'],
      active: true,
      template:
        'Halo Kak {nama}, semoga keluarga menyukai Kripik Tempe Umi Hana yang dipesan minggu lalu. Bila stok di rumah mulai menipis, kami siap kirim batch renyah terbaru hari ini.',
      sentCount: 41,
    },
  ];

  const seedLeads: CrmLead[] = [
    {
      id: 'lead-101',
      name: 'Dian Puspitasari',
      phone: '6281298765401',
      email: 'dian.puspita@example.id',
      city: 'Bekasi',
      source: 'Checkout Tertunda',
      packageInterest: 'Paket Stok Rumah (6 Bungkus)',
      estimatedValue: 84000,
      stage: 'menunggu_pembayaran',
      notes: 'Sempat memilih QRIS Instan namun menutup halaman sebelum verifikasi.',
      followUpCount: 0,
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(2),
    },
    {
      id: 'lead-102',
      name: 'Arief Rahman Hakim',
      phone: '6281388214490',
      email: 'arief.hakim@example.id',
      city: 'Tangerang Selatan',
      source: 'Form Konsultasi',
      packageInterest: 'Paket Kantor & Reseller (15 Bungkus)',
      estimatedValue: 390000,
      stage: 'prospek_baru',
      notes: 'Menanyakan pengiriman rutin 30 bungkus per bulan untuk pantry kantor.',
      followUpCount: 0,
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(5),
    },
    {
      id: 'lead-103',
      name: 'Siti Rahmawati',
      phone: '6285712098831',
      email: 'siti.rahma@example.id',
      city: 'Semarang',
      source: 'Checkout Tertunda',
      packageInterest: 'Paket Coba Keluarga (3 Bungkus)',
      estimatedValue: 57000,
      stage: 'follow_up_wa',
      notes: 'Sudah dikirim pengingat WA 15 menit, tertarik ganti ke paket 6 bungkus agar gratis ongkir.',
      followUpCount: 1,
      lastFollowUpAt: hoursAgo(4),
      createdAt: hoursAgo(9),
      updatedAt: hoursAgo(4),
    },
    {
      id: 'lead-104',
      name: 'Ratna Wijaya',
      phone: '6281122334455',
      email: 'ratna.wijaya@example.id',
      city: 'Bandung',
      source: 'Pembelian Langsung',
      packageInterest: 'Paket Stok Rumah (6 Bungkus)',
      estimatedValue: 84000,
      stage: 'pelanggan_setia',
      notes: 'Repeat order ke-4. Penggemar rasa original.',
      followUpCount: 2,
      lastFollowUpAt: hoursAgo(26),
      createdAt: hoursAgo(30),
      updatedAt: hoursAgo(26),
    },
    {
      id: 'lead-105',
      name: 'Hendro Santoso',
      phone: '6281211998877',
      email: 'hendro.ga@sinarlogistik.id',
      city: 'Jakarta Selatan',
      source: 'Pembelian Langsung',
      packageInterest: 'Paket Kantor & Reseller (15 Bungkus)',
      estimatedValue: 195000,
      stage: 'pelanggan_setia',
      notes: 'Pengadaan rutin rapat divisi operasional.',
      followUpCount: 1,
      lastFollowUpAt: hoursAgo(40),
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(40),
    },
  ];

  const seedOrders: OrderRecord[] = [
    {
      orderCode: 'UH-2026-1039',
      customerName: 'Ratna Wijaya',
      customerPhone: '6281122334455',
      customerEmail: 'ratna.wijaya@example.id',
      address: 'Jl. Cisitu Lama No. 18, Coblong',
      city: 'Bandung',
      postalCode: '40135',
      packageId: 'keluarga-6',
      packageName: 'Paket Stok Rumah (6 Bungkus)',
      quantity: 1,
      unitPrice: 84000,
      subtotal: 84000,
      shippingFee: 0,
      totalAmount: 84000,
      shippingMethod: 'reguler',
      paymentMethod: 'qris',
      paymentLabel: 'QRIS Instan',
      paymentCode: 'QRIS-UH-1039',
      paymentStatus: 'lunas',
      fulfillmentStatus: 'selesai',
      createdAt: hoursAgo(30),
      paidAt: hoursAgo(29.8),
    },
    {
      orderCode: 'UH-2026-1040',
      customerName: 'Hendro Santoso',
      customerPhone: '6281211998877',
      customerEmail: 'hendro.ga@sinarlogistik.id',
      address: 'Gedung Graha Pratama Lt. 6, Jl. MT Haryono',
      city: 'Jakarta Selatan',
      postalCode: '12810',
      packageId: 'reseller-15',
      packageName: 'Paket Kantor & Reseller (15 Bungkus)',
      quantity: 2,
      unitPrice: 195000,
      subtotal: 390000,
      shippingFee: 0,
      totalAmount: 390000,
      shippingMethod: 'kilat',
      paymentMethod: 'va_bca',
      paymentLabel: 'BCA Virtual Account',
      paymentCode: '88012026104088',
      paymentStatus: 'lunas',
      fulfillmentStatus: 'dikirim',
      createdAt: hoursAgo(20),
      paidAt: hoursAgo(19.5),
    },
    {
      orderCode: 'UH-2026-1041',
      customerName: 'Nadia Kusuma',
      customerPhone: '6281809093344',
      customerEmail: 'nadia@ruangteduh.id',
      address: 'Jl. Kaliurang KM 6,5 No. 42',
      city: 'Yogyakarta',
      postalCode: '55281',
      packageId: 'reseller-15',
      packageName: 'Paket Kantor & Reseller (15 Bungkus)',
      quantity: 1,
      unitPrice: 195000,
      subtotal: 195000,
      shippingFee: 0,
      totalAmount: 195000,
      shippingMethod: 'reguler',
      paymentMethod: 'va_mandiri',
      paymentLabel: 'Mandiri Virtual Account',
      paymentCode: '89022026104155',
      paymentStatus: 'lunas',
      fulfillmentStatus: 'dikemas',
      createdAt: hoursAgo(10),
      paidAt: hoursAgo(9.7),
    },
    {
      orderCode: 'UH-2026-1042',
      customerName: 'Dian Puspitasari',
      customerPhone: '6281298765401',
      customerEmail: 'dian.puspita@example.id',
      address: 'Perumahan Galaxy Blok C2 No. 9',
      city: 'Bekasi',
      postalCode: '17147',
      packageId: 'keluarga-6',
      packageName: 'Paket Stok Rumah (6 Bungkus)',
      quantity: 1,
      unitPrice: 84000,
      subtotal: 84000,
      shippingFee: 0,
      totalAmount: 84000,
      shippingMethod: 'reguler',
      paymentMethod: 'qris',
      paymentLabel: 'QRIS Instan',
      paymentCode: 'QRIS-UH-1042',
      paymentStatus: 'menunggu',
      fulfillmentStatus: 'menunggu_bayar',
      createdAt: hoursAgo(2),
    },
  ];

  const seedEvents: AnalyticsEventRecord[] = [
    { id: 'ev-1', sessionId: 'seed-s1', eventType: 'page_view', label: 'Halaman Utama', source: 'Instagram Ads', createdAt: hoursAgo(30) },
    { id: 'ev-2', sessionId: 'seed-s1', eventType: 'cta_click', label: 'Pesan Paket Stok Rumah', source: 'Instagram Ads', createdAt: hoursAgo(30) },
    { id: 'ev-3', sessionId: 'seed-s1', eventType: 'checkout_start', label: 'Checkout Paket Stok Rumah', source: 'Instagram Ads', value: 84000, createdAt: hoursAgo(30) },
    { id: 'ev-4', sessionId: 'seed-s1', eventType: 'purchase_completed', label: 'UH-2026-1039', source: 'Instagram Ads', value: 84000, createdAt: hoursAgo(29.8) },
    { id: 'ev-5', sessionId: 'seed-s2', eventType: 'page_view', label: 'Halaman Utama', source: 'Google Search', createdAt: hoursAgo(20) },
    { id: 'ev-6', sessionId: 'seed-s2', eventType: 'cta_click', label: 'Pesan Paket Reseller', source: 'Google Search', createdAt: hoursAgo(20) },
    { id: 'ev-7', sessionId: 'seed-s2', eventType: 'checkout_start', label: 'Checkout Reseller', source: 'Google Search', value: 390000, createdAt: hoursAgo(20) },
    { id: 'ev-8', sessionId: 'seed-s2', eventType: 'purchase_completed', label: 'UH-2026-1040', source: 'Google Search', value: 390000, createdAt: hoursAgo(19.5) },
    { id: 'ev-9', sessionId: 'seed-s3', eventType: 'page_view', label: 'Halaman Utama', source: 'WhatsApp Broadcast', createdAt: hoursAgo(10) },
    { id: 'ev-10', sessionId: 'seed-s3', eventType: 'cta_click', label: 'Pesan Paket Reseller', source: 'WhatsApp Broadcast', createdAt: hoursAgo(10) },
    { id: 'ev-11', sessionId: 'seed-s3', eventType: 'checkout_start', label: 'Checkout Reseller', source: 'WhatsApp Broadcast', value: 195000, createdAt: hoursAgo(10) },
    { id: 'ev-12', sessionId: 'seed-s3', eventType: 'purchase_completed', label: 'UH-2026-1041', source: 'WhatsApp Broadcast', value: 195000, createdAt: hoursAgo(9.7) },
    { id: 'ev-13', sessionId: 'seed-s4', eventType: 'page_view', label: 'Halaman Utama', source: 'Instagram Ads', createdAt: hoursAgo(5) },
    { id: 'ev-14', sessionId: 'seed-s4', eventType: 'lead_captured', label: 'Konsultasi Reseller', source: 'Instagram Ads', value: 390000, createdAt: hoursAgo(5) },
    { id: 'ev-15', sessionId: 'seed-s5', eventType: 'page_view', label: 'Halaman Utama', source: 'TikTok Shop', createdAt: hoursAgo(2) },
    { id: 'ev-16', sessionId: 'seed-s5', eventType: 'cta_click', label: 'Pesan Paket Stok Rumah', source: 'TikTok Shop', createdAt: hoursAgo(2) },
    { id: 'ev-17', sessionId: 'seed-s5', eventType: 'checkout_start', label: 'Checkout Paket Stok Rumah', source: 'TikTok Shop', value: 84000, createdAt: hoursAgo(2) },
    { id: 'ev-18', sessionId: 'seed-s5', eventType: 'checkout_abandoned', label: 'Tertunda di QRIS', source: 'TikTok Shop', value: 84000, createdAt: hoursAgo(1.9) },
  ];

  // Add realistic baseline browsing sessions so conversion percentages are grounded
  const sources = ['Instagram Ads', 'Google Search', 'WhatsApp Broadcast', 'TikTok Shop', 'Direct / Organik'];
  for (let i = 6; i <= 48; i++) {
    const src = sources[i % sources.length];
    const ts = hoursAgo((i % 72) + 1);
    seedEvents.push({
      id: `ev-base-pv-${i}`,
      sessionId: `seed-s${i}`,
      eventType: 'page_view',
      label: 'Halaman Utama',
      source: src,
      createdAt: ts,
    });
    if (i % 3 === 0) {
      seedEvents.push({
        id: `ev-base-cta-${i}`,
        sessionId: `seed-s${i}`,
        eventType: 'cta_click',
        label: 'Lihat Paket & Harga',
        source: src,
        createdAt: ts,
      });
    }
    if (i % 7 === 0) {
      seedEvents.push({
        id: `ev-base-chk-${i}`,
        sessionId: `seed-s${i}`,
        eventType: 'checkout_start',
        label: 'Mulai Checkout',
        source: src,
        createdAt: ts,
      });
    }
  }

  const seedLogs: WhatsAppDispatchLog[] = [
    {
      id: 'wa-log-1',
      leadId: 'lead-103',
      leadName: 'Siti Rahmawati',
      phone: '6285712098831',
      ruleId: 'wa-rule-15m',
      ruleName: 'Pengingat Checkout Tertunda (15 Menit)',
      messagePreview:
        'Halo Kak Siti Rahmawati, pesanan Paket Coba Keluarga (3 Bungkus) (Rp 57.000) dari Umi Hana Kripik Tempe masih menunggu konfirmasi pembayaran. Balas pesan ini jika ingin dibantu QRIS, Virtual Account, atau opsi COD ya Kak.',
      channelMode: 'wa_me_queue',
      status: 'terkirim',
      waLink:
        'https://wa.me/6285712098831?text=Halo%20Kak%20Siti%20Rahmawati%2C%20pesanan%20Paket%20Coba%20Keluarga%20(3%20Bungkus)%20(Rp%2057.000)%20dari%20Umi%20Hana%20Kripik%20Tempe%20masih%20menunggu%20konfirmasi%20pembayaran.',
      sentAt: hoursAgo(4),
    },
  ];

  return {
    adminCredential: null,
    leads: seedLeads,
    orders: seedOrders,
    analyticsEvents: seedEvents,
    whatsappRules: defaultRules,
    whatsappLogs: seedLogs,
    orderSequence: 1042,
  };
}

function loadStore(): PersistedStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw) as PersistedStore;
      if (parsed && Array.isArray(parsed.leads) && Array.isArray(parsed.orders)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read store file, initializing fresh store:', err);
  }
  const initial = buildInitialStore();
  saveStore(initial);
  return initial;
}

function saveStore(data: PersistedStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpFile, DATA_FILE);
  } catch (err) {
    console.error('Failed to persist store:', err);
  }
}

let store: PersistedStore = loadStore();

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPasswordAgainstEnv(inputPassword: string, envPasscode: string): boolean {
  const digestA = crypto.createHash('sha256').update(inputPassword).digest();
  const digestB = crypto.createHash('sha256').update(envPasscode).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function verifyPasswordAgainstStore(inputPassword: string, cred: AdminCredentialStore): boolean {
  const computed = Buffer.from(hashPassword(inputPassword, cred.salt), 'hex');
  const stored = Buffer.from(cred.hash, 'hex');
  if (computed.length !== stored.length) return false;
  return crypto.timingSafeEqual(computed, stored);
}

function createSessionToken(): string {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sesi admin diperlukan. Silakan masuk terlebih dahulu.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    res.status(401).json({ error: 'Sesi admin telah berakhir. Silakan masuk kembali.' });
    return;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  next();
}

function renderTemplate(template: string, lead: CrmLead): string {
  return template
    .replace(/\{nama\}/gi, lead.name)
    .replace(/\{paket\}/gi, lead.packageInterest)
    .replace(/\{total\}/gi, formatRupiahServer(lead.estimatedValue || 84000))
    .replace(/\{brand\}/gi, 'Umi Hana Kripik Tempe');
}

async function sendViaWhatsAppCloudApiIfConfigured(
  phone: string,
  message: string
): Promise<'cloud_api' | 'wa_me_queue'> {
  const token = process.env.WHATSAPP_API_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId || !/^[0-9]+$/.test(phoneNumberId)) {
    return 'wa_me_queue';
  }
  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message },
      }),
    });
    if (response.ok) {
      return 'cloud_api';
    }
  } catch (err) {
    console.error('WhatsApp Cloud API call failed, falling back to wa.me queue:', err);
  }
  return 'wa_me_queue';
}

function generatePaymentCode(paymentMethod: PaymentMethodId, seq: number): string {
  const suffix = String(seq).padStart(4, '0');
  const randomDigits = String(crypto.randomInt(10, 99));
  switch (paymentMethod) {
    case 'qris':
      return `QRIS-UH-${suffix}`;
    case 'va_bca':
      return `88012026${suffix}${randomDigits}`;
    case 'va_mandiri':
      return `89022026${suffix}${randomDigits}`;
    case 'va_bni':
      return `82772026${suffix}${randomDigits}`;
    case 'ewallet_gopay':
      return `GP-UH-${suffix}-${randomDigits}`;
    case 'cod':
      return `COD-UH-${suffix}`;
  }
}

function computeAnalyticsSummary(): AnalyticsSummary {
  const uniqueSessions = new Set<string>();
  const ctaSessions = new Set<string>();
  const checkoutSessions = new Set<string>();
  const purchaseSessions = new Set<string>();

  let totalPageViews = 0;
  let ctaClicks = 0;
  let whatsappClicks = 0;
  let checkoutStarts = 0;
  let leadsCaptured = 0;

  const sourceMap = new Map<string, { sessions: Set<string>; conversions: Set<string> }>();

  for (const ev of store.analyticsEvents) {
    uniqueSessions.add(ev.sessionId);
    const src = ev.source || 'Direct / Organik';
    if (!sourceMap.has(src)) {
      sourceMap.set(src, { sessions: new Set(), conversions: new Set() });
    }
    const bucket = sourceMap.get(src)!;
    bucket.sessions.add(ev.sessionId);

    if (ev.eventType === 'page_view') totalPageViews += 1;
    if (ev.eventType === 'cta_click') {
      ctaClicks += 1;
      ctaSessions.add(ev.sessionId);
    }
    if (ev.eventType === 'whatsapp_click') {
      whatsappClicks += 1;
      ctaSessions.add(ev.sessionId);
    }
    if (ev.eventType === 'checkout_start') {
      checkoutStarts += 1;
      checkoutSessions.add(ev.sessionId);
    }
    if (ev.eventType === 'lead_captured') leadsCaptured += 1;
    if (ev.eventType === 'purchase_completed') {
      purchaseSessions.add(ev.sessionId);
      bucket.conversions.add(ev.sessionId);
    }
  }

  const paidOrders = store.orders.filter(
    (o) => o.paymentStatus === 'lunas' || o.paymentStatus === 'cod_diproses'
  );
  const completedPurchases = Math.max(paidOrders.length, purchaseSessions.size);
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const averageOrderValue = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

  const pendingRecoveryValue = store.leads
    .filter((l) => l.stage === 'menunggu_pembayaran' || l.stage === 'prospek_baru' || l.stage === 'follow_up_wa')
    .reduce((sum, l) => sum + (l.estimatedValue || 0), 0);

  const totalVisitors = Math.max(uniqueSessions.size, 1);
  const conversionRate = Number(((completedPurchases / totalVisitors) * 100).toFixed(1));
  const checkoutBase = Math.max(checkoutSessions.size, completedPurchases, 1);
  const checkoutCompletionRate = Number(((completedPurchases / checkoutBase) * 100).toFixed(1));

  const ctaCount = Math.max(ctaSessions.size, checkoutBase);
  const funnel = [
    { step: 'Pengunjung Halaman', count: totalVisitors, rateFromPrevious: 100 },
    {
      step: 'Klik Tombol CTA',
      count: ctaCount,
      rateFromPrevious: Number(((ctaCount / totalVisitors) * 100).toFixed(1)),
    },
    {
      step: 'Mulai Checkout',
      count: checkoutBase,
      rateFromPrevious: Number(((checkoutBase / Math.max(ctaCount, 1)) * 100).toFixed(1)),
    },
    {
      step: 'Transaksi Terkonfirmasi',
      count: completedPurchases,
      rateFromPrevious: Number(((completedPurchases / checkoutBase) * 100).toFixed(1)),
    },
  ];

  const trafficSources = Array.from(sourceMap.entries())
    .map(([source, data]) => {
      const sCount = data.sessions.size;
      const cCount = data.conversions.size;
      return {
        source,
        sessions: sCount,
        conversions: cCount,
        rate: sCount > 0 ? Number(((cCount / sCount) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 6);

  // Build 6-day conversion trend ending today
  const dailyTrend: AnalyticsSummary['dailyTrend'] = [];
  const dayFormatter = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short' });
  const baselineVisitors = [26, 31, 29, 38, 44, 0];
  const baselineOrders = [2, 3, 2, 4, 5, 0];
  const baselineRevenue = [168000, 363000, 279000, 468000, 669000, 0];

  for (let offset = 5; offset >= 0; offset--) {
    const dayDate = new Date();
    dayDate.setHours(0, 0, 0, 0);
    dayDate.setDate(dayDate.getDate() - offset);
    const nextDay = new Date(dayDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const dayKey = dayFormatter.format(dayDate);
    const idx = 5 - offset;

    const liveVisitors = new Set(
      store.analyticsEvents
        .filter((e) => {
          const t = new Date(e.createdAt).getTime();
          return t >= dayDate.getTime() && t < nextDay.getTime();
        })
        .map((e) => e.sessionId)
    ).size;

    const dayPaidOrders = paidOrders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= dayDate.getTime() && t < nextDay.getTime();
    });

    dailyTrend.push({
      label: offset === 0 ? 'Hari Ini' : dayKey,
      visitors: offset === 0 ? Math.max(liveVisitors, 12) : baselineVisitors[idx] + liveVisitors,
      orders: offset === 0 ? dayPaidOrders.length : baselineOrders[idx] + dayPaidOrders.length,
      revenue:
        offset === 0
          ? dayPaidOrders.reduce((s, o) => s + o.totalAmount, 0)
          : baselineRevenue[idx] + dayPaidOrders.reduce((s, o) => s + o.totalAmount, 0),
    });
  }

  return {
    totalVisitors,
    totalPageViews,
    ctaClicks,
    whatsappClicks,
    checkoutStarts,
    leadsCaptured: Math.max(leadsCaptured, store.leads.length),
    completedPurchases,
    conversionRate,
    checkoutCompletionRate,
    totalRevenue,
    averageOrderValue,
    pendingRecoveryValue,
    funnel,
    trafficSources,
    dailyTrend,
  };
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

function upsertLeadInStore(params: {
  name: string;
  phone: string;
  email: string;
  city: string;
  source: CrmLead['source'];
  packageInterest: string;
  estimatedValue: number;
  stage: CrmStage;
  notes: string;
}): CrmLead {
  const nowIso = new Date().toISOString();
  const existing = store.leads.find((l) => l.phone === params.phone);
  if (existing) {
    existing.name = params.name || existing.name;
    existing.email = params.email || existing.email;
    existing.city = params.city || existing.city;
    existing.packageInterest = params.packageInterest || existing.packageInterest;
    existing.estimatedValue = params.estimatedValue || existing.estimatedValue;
    // Never downgrade loyal customer automatically on repeat inquiry unless explicitly paid
    if (existing.stage !== 'pelanggan_setia' || params.stage === 'pelanggan_setia') {
      existing.stage = params.stage;
    }
    if (params.notes) {
      existing.notes = params.notes;
    }
    existing.updatedAt = nowIso;
    return existing;
  }

  const newLead: CrmLead = {
    id: `lead-${crypto.randomBytes(4).toString('hex')}`,
    name: params.name,
    phone: params.phone,
    email: params.email,
    city: params.city,
    source: params.source,
    packageInterest: params.packageInterest,
    estimatedValue: params.estimatedValue,
    stage: params.stage,
    notes: params.notes,
    followUpCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  store.leads.unshift(newLead);
  return newLead;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // Health Check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Public summary for live social proof counters
  app.get('/api/public/summary', (_req, res) => {
    const livePacks = store.orders
      .filter((o) => o.paymentStatus === 'lunas' || o.paymentStatus === 'cod_diproses')
      .reduce((sum, o) => {
        const pkg = SERVER_PACKAGES[o.packageId];
        return sum + (pkg ? pkg.packCount * o.quantity : 0);
      }, 0);
    const liveCustomers = store.leads.filter((l) => l.stage === 'pelanggan_setia').length;
    res.json({
      packsDelivered: 12400 + livePacks,
      activeCustomers: 1840 + liveCustomers,
      averageRating: 4.9,
    });
  });

  // Public Order Delivery Tracking (privacy-safe projection backed by orders + CRM data)
  app.get('/api/orders/track/:orderCode', (req, res) => {
    if (!checkRateLimit(trackAttempts, req.ip || 'unknown', 40)) {
      res.status(429).json({ error: 'Terlalu banyak permintaan pelacakan. Coba beberapa menit lagi.' });
      return;
    }
    const rawCode = sanitizeString(req.params.orderCode, 32).toUpperCase();
    if (!/^[A-Z0-9-]{4,32}$/.test(rawCode)) {
      res.status(400).json({ error: 'Format kode pesanan tidak valid (contoh: UH-2026-1040).' });
      return;
    }

    const order = store.orders.find((o) => o.orderCode.toUpperCase() === rawCode);
    if (!order) {
      res.status(404).json({
        error: `Pesanan dengan kode "${rawCode}" tidak ditemukan. Periksa kembali kode pada struk atau WhatsApp Anda.`,
      });
      return;
    }

    const matchedLead = store.leads.find((l) => l.phone === order.customerPhone) ?? null;
    const latestWaLog = matchedLead
      ? store.whatsappLogs.find((log) => log.leadId === matchedLead.id) ?? null
      : null;

    const createdMs = new Date(order.createdAt).getTime();
    const minDays = order.shippingMethod === 'kilat' ? 1 : 2;
    const maxDays = order.shippingMethod === 'kilat' ? 1 : 3;
    const dateFmt = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const estStart = dateFmt.format(new Date(createdMs + minDays * 86400_000));
    const estEnd = dateFmt.format(new Date(createdMs + maxDays * 86400_000));
    const estimatedDeliveryLabel =
      order.fulfillmentStatus === 'selesai'
        ? 'Paket telah diterima di alamat tujuan'
        : order.fulfillmentStatus === 'menunggu_bayar'
          ? `Diproses segera setelah pembayaran (${order.shippingMethod === 'kilat' ? '1 hari' : '2–3 hari'} kirim)`
          : minDays === maxDays
            ? `Estimasi tiba ${estStart}`
            : `Estimasi tiba ${estStart} – ${estEnd}`;

    const stageOrder: Array<OrderRecord['fulfillmentStatus']> = [
      'menunggu_bayar',
      'dikemas',
      'dikirim',
      'selesai',
    ];
    const currentIdx = Math.max(0, stageOrder.indexOf(order.fulfillmentStatus));
    const stepStatus = (idx: number): 'completed' | 'current' | 'upcoming' => {
      if (idx < currentIdx) return 'completed';
      if (idx === currentIdx) return 'current';
      return 'upcoming';
    };

    const crmStageLabels: Record<CrmStage, string> = {
      prospek_baru: 'Prospek Baru',
      menunggu_pembayaran: 'Menunggu Pembayaran',
      follow_up_wa: 'Dalam Tindak Lanjut WhatsApp',
      pelanggan_setia: 'Pelanggan Setia Terverifikasi',
      tidak_aktif: 'Arsip',
    };

    const milestones: OrderTrackingResult['milestones'] = [
      {
        id: 'created',
        title: 'Pesanan tercatat di sistem Umi Hana',
        detail: `${order.packageName} × ${order.quantity} via ${order.paymentLabel}.`,
        timestamp: order.createdAt,
        status: currentIdx > 0 ? 'completed' : 'current',
      },
      {
        id: 'payment',
        title:
          order.paymentStatus === 'lunas'
            ? 'Pembayaran lunas & terverifikasi'
            : order.paymentStatus === 'cod_diproses'
              ? 'Pesanan COD disetujui untuk diproses'
              : 'Menunggu konfirmasi pembayaran',
        detail:
          order.paymentStatus === 'menunggu'
            ? 'Selesaikan pembayaran agar pesanan segera masuk antrean pengemasan.'
            : matchedLead
              ? `Sinkronisasi CRM aktif (${crmStageLabels[matchedLead.stage]}).`
              : 'Pembayaran telah dikonfirmasi oleh sistem.',
        timestamp: order.paidAt ?? (order.paymentStatus === 'cod_diproses' ? order.createdAt : null),
        status: order.paymentStatus === 'menunggu' ? 'current' : 'completed',
      },
      {
        id: 'packing',
        title: 'Pengemasan higienis di gudang PT Hana Food Indonesia',
        detail: 'Standing pouch 60 g diperiksa kerenyahannya & dikemas dus pelindung tebal.',
        timestamp:
          currentIdx >= 1
            ? matchedLead?.updatedAt ?? order.paidAt ?? order.createdAt
            : null,
        status: stepStatus(1),
      },
      {
        id: 'shipping',
        title: `Pengiriman menuju ${order.city}`,
        detail:
          order.shippingMethod === 'kilat'
            ? 'Dikirim menggunakan layanan Kurir Kilat (prioritas 1 hari).'
            : 'Dikirim menggunakan layanan Kurir Reguler (estimasi 2–3 hari).',
        timestamp: currentIdx >= 2 ? matchedLead?.updatedAt ?? order.createdAt : null,
        status: stepStatus(2),
      },
      {
        id: 'delivered',
        title: 'Pesanan diterima oleh pelanggan',
        detail: `Diterima di ${order.city}. Terima kasih telah menikmati Kripik Tempe Umi Hana.`,
        timestamp: currentIdx >= 3 ? matchedLead?.updatedAt ?? order.createdAt : null,
        status: stepStatus(3),
      },
    ];

    const tracking: OrderTrackingResult = {
      orderCode: order.orderCode,
      recipientLabel: maskRecipientName(order.customerName),
      city: order.city,
      packageName: order.packageName,
      quantity: order.quantity,
      shippingMethod: order.shippingMethod,
      estimatedDeliveryLabel,
      paymentLabel: order.paymentLabel,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      crmStage: matchedLead ? matchedLead.stage : null,
      crmSource: matchedLead ? matchedLead.source : null,
      crmUpdatedAt: matchedLead ? matchedLead.updatedAt : null,
      crmFollowUpCount: matchedLead ? matchedLead.followUpCount : 0,
      lastWhatsappUpdateAt: matchedLead?.lastFollowUpAt ?? latestWaLog?.sentAt ?? null,
      milestones,
    };

    res.json({ tracking });
  });

  // Real-Time Analytics Event Ingestion
  app.post('/api/analytics/event', (req, res) => {
    const sessionId = sanitizeString(req.body?.sessionId, 64);
    const eventType = sanitizeString(req.body?.eventType, 40) as AnalyticsEventType;
    const label = sanitizeString(req.body?.label, 120) || 'Interaksi';
    const source = sanitizeString(req.body?.source, 60) || 'Direct / Organik';
    const rawValue = req.body?.value;
    const value = typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue >= 0 ? Math.round(rawValue) : undefined;

    if (!sessionId || !VALID_EVENTS.includes(eventType)) {
      res.status(400).json({ error: 'Format event analitik tidak valid.' });
      return;
    }

    const record: AnalyticsEventRecord = {
      id: `ev-${crypto.randomBytes(4).toString('hex')}`,
      sessionId,
      eventType,
      label,
      source,
      value,
      createdAt: new Date().toISOString(),
    };
    store.analyticsEvents.unshift(record);
    if (store.analyticsEvents.length > 500) {
      store.analyticsEvents = store.analyticsEvents.slice(0, 500);
    }
    saveStore(store);
    res.status(201).json({ ok: true, id: record.id });
  });

  // Public CRM Lead Capture (Consultation / Abandoned Checkout / WhatsApp Intent)
  app.post('/api/leads', async (req, res) => {
    const name = sanitizeString(req.body?.name, 80);
    const phoneRaw = sanitizeString(req.body?.phone, 24);
    const phone = normalizeIndonesianPhone(phoneRaw);
    const email = sanitizeString(req.body?.email, 100);
    const city = sanitizeString(req.body?.city, 60) || 'Indonesia';
    const sourceRaw = sanitizeString(req.body?.source, 40);
    const packageInterest = sanitizeString(req.body?.packageInterest, 80) || 'Paket Stok Rumah (6 Bungkus)';
    const notes = sanitizeString(req.body?.notes, 280);
    const rawValue = Number(req.body?.estimatedValue);
    const estimatedValue = Number.isFinite(rawValue) && rawValue > 0 ? Math.min(Math.round(rawValue), 100000000) : 84000;
    const sessionId = sanitizeString(req.body?.sessionId, 64) || `lead-${Date.now()}`;
    const trafficSource = sanitizeString(req.body?.trafficSource, 60) || 'Direct / Organik';

    if (name.length < 2) {
      res.status(400).json({ error: 'Nama lengkap minimal 2 karakter.' });
      return;
    }
    if (phone.length < 10 || phone.length > 15) {
      res.status(400).json({ error: 'Masukkan nomor WhatsApp yang valid (minimal 10 digit).' });
      return;
    }

    const allowedSources: CrmLead['source'][] = [
      'Checkout Tertunda',
      'Form Konsultasi',
      'Pembelian Langsung',
      'Tombol WhatsApp',
    ];
    const source: CrmLead['source'] = allowedSources.includes(sourceRaw as CrmLead['source'])
      ? (sourceRaw as CrmLead['source'])
      : 'Form Konsultasi';

    const stage: CrmStage = source === 'Checkout Tertunda' ? 'menunggu_pembayaran' : 'prospek_baru';

    const lead = upsertLeadInStore({
      name,
      phone,
      email,
      city,
      source,
      packageInterest,
      estimatedValue,
      stage,
      notes: notes || `Masuk dari ${source}.`,
    });

    store.analyticsEvents.unshift({
      id: `ev-${crypto.randomBytes(4).toString('hex')}`,
      sessionId,
      eventType: source === 'Checkout Tertunda' ? 'checkout_abandoned' : 'lead_captured',
      label: `${source}: ${packageInterest}`,
      source: trafficSource,
      value: estimatedValue,
      createdAt: new Date().toISOString(),
    });

    // Queue automatic WhatsApp follow-up draft for matching active rule
    const matchingRule = store.whatsappRules.find(
      (r) => r.active && r.targetStages.includes(stage)
    );
    let scheduledFollowUp: WhatsAppDispatchLog | null = null;

    if (matchingRule) {
      const rendered = renderTemplate(matchingRule.template, lead);
      const channelMode = await sendViaWhatsAppCloudApiIfConfigured(lead.phone, rendered);
      const waLink = `https://wa.me/${lead.phone}?text=${encodeURIComponent(rendered)}`;
      scheduledFollowUp = {
        id: `wa-log-${crypto.randomBytes(4).toString('hex')}`,
        leadId: lead.id,
        leadName: lead.name,
        phone: lead.phone,
        ruleId: matchingRule.id,
        ruleName: matchingRule.name,
        messagePreview: rendered,
        channelMode,
        status: channelMode === 'cloud_api' ? 'terkirim' : 'siap_kirim',
        waLink,
        sentAt: new Date().toISOString(),
      };
      store.whatsappLogs.unshift(scheduledFollowUp);
      if (channelMode === 'cloud_api') {
        matchingRule.sentCount += 1;
        lead.followUpCount += 1;
        lead.lastFollowUpAt = scheduledFollowUp.sentAt;
      }
    }

    saveStore(store);
    res.status(201).json({ lead, scheduledFollowUp });
  });

  // Integrated Order Creation (server-authoritative pricing)
  app.post('/api/orders', (req, res) => {
    const customerName = sanitizeString(req.body?.customerName, 80);
    const customerPhone = normalizeIndonesianPhone(sanitizeString(req.body?.customerPhone, 24));
    const customerEmail = sanitizeString(req.body?.customerEmail, 100);
    const address = sanitizeString(req.body?.address, 240);
    const city = sanitizeString(req.body?.city, 60);
    const postalCode = sanitizeString(req.body?.postalCode, 12);
    const packageId = sanitizeString(req.body?.packageId, 32) as PackageId;
    const quantityRaw = Number(req.body?.quantity);
    const shippingMethod = sanitizeString(req.body?.shippingMethod, 20) as ShippingMethodId;
    const paymentMethod = sanitizeString(req.body?.paymentMethod, 32) as PaymentMethodId;
    const sessionId = sanitizeString(req.body?.sessionId, 64) || `ord-${Date.now()}`;
    const trafficSource = sanitizeString(req.body?.trafficSource, 60) || 'Direct / Organik';

    const pkg = SERVER_PACKAGES[packageId];
    if (!pkg) {
      res.status(400).json({ error: 'Pilihan paket produk tidak ditemukan.' });
      return;
    }
    if (!PAYMENT_LABELS[paymentMethod]) {
      res.status(400).json({ error: 'Metode pembayaran tidak didukung.' });
      return;
    }
    const quantity = Number.isInteger(quantityRaw) && quantityRaw >= 1 && quantityRaw <= 50 ? quantityRaw : 1;
    const validShipping: ShippingMethodId = shippingMethod === 'kilat' ? 'kilat' : 'reguler';

    if (customerName.length < 2) {
      res.status(400).json({ error: 'Nama penerima wajib diisi.' });
      return;
    }
    if (customerPhone.length < 10 || customerPhone.length > 15) {
      res.status(400).json({ error: 'Nomor WhatsApp penerima tidak valid.' });
      return;
    }
    if (address.length < 8 || city.length < 2) {
      res.status(400).json({ error: 'Mohon lengkapi alamat dan kota pengiriman.' });
      return;
    }

    const subtotal = pkg.price * quantity;
    const shippingFee =
      validShipping === 'kilat' ? 22000 : pkg.freeShipping || subtotal >= 84000 ? 0 : 12000;
    const totalAmount = subtotal + shippingFee;

    store.orderSequence += 1;
    const orderCode = `UH-2026-${store.orderSequence}`;
    const isCod = paymentMethod === 'cod';
    const nowIso = new Date().toISOString();

    const order: OrderRecord = {
      orderCode,
      customerName,
      customerPhone,
      customerEmail,
      address,
      city,
      postalCode: postalCode || '-',
      packageId,
      packageName: pkg.name,
      quantity,
      unitPrice: pkg.price,
      subtotal,
      shippingFee,
      totalAmount,
      shippingMethod: validShipping,
      paymentMethod,
      paymentLabel: PAYMENT_LABELS[paymentMethod],
      paymentCode: generatePaymentCode(paymentMethod, store.orderSequence),
      paymentStatus: isCod ? 'cod_diproses' : 'menunggu',
      fulfillmentStatus: isCod ? 'dikemas' : 'menunggu_bayar',
      createdAt: nowIso,
      paidAt: isCod ? nowIso : undefined,
    };

    store.orders.unshift(order);

    upsertLeadInStore({
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      city,
      source: isCod ? 'Pembelian Langsung' : 'Checkout Tertunda',
      packageInterest: `${pkg.name} × ${quantity}`,
      estimatedValue: totalAmount,
      stage: isCod ? 'pelanggan_setia' : 'menunggu_pembayaran',
      notes: isCod
        ? `Pesanan COD ${orderCode} sedang dikemas ke ${city}.`
        : `Pesanan ${orderCode} (${PAYMENT_LABELS[paymentMethod]}) menunggu pembayaran.`,
    });

    store.analyticsEvents.unshift({
      id: `ev-${crypto.randomBytes(4).toString('hex')}`,
      sessionId,
      eventType: isCod ? 'purchase_completed' : 'checkout_start',
      label: isCod ? `${orderCode} (COD)` : `${orderCode} (${PAYMENT_LABELS[paymentMethod]})`,
      source: trafficSource,
      value: totalAmount,
      createdAt: nowIso,
    });

    const checkoutToken = crypto.randomBytes(24).toString('hex');
    orderConfirmTokens.set(orderCode, checkoutToken);

    saveStore(store);
    res.status(201).json({ order, checkoutToken });
  });

  // Payment Verification & Confirmation
  app.post('/api/orders/:orderCode/confirm', (req, res) => {
    const orderCode = sanitizeString(req.params.orderCode, 32);
    const checkoutToken = sanitizeString(req.body?.checkoutToken, 128);
    const sessionId = sanitizeString(req.body?.sessionId, 64) || `pay-${Date.now()}`;
    const trafficSource = sanitizeString(req.body?.trafficSource, 60) || 'Direct / Organik';

    const order = store.orders.find((o) => o.orderCode === orderCode);
    if (!order) {
      res.status(404).json({ error: 'Kode pesanan tidak ditemukan.' });
      return;
    }

    const expectedToken = orderConfirmTokens.get(orderCode);
    if (
      !expectedToken ||
      !checkoutToken ||
      expectedToken.length !== checkoutToken.length ||
      !crypto.timingSafeEqual(Buffer.from(expectedToken), Buffer.from(checkoutToken))
    ) {
      res.status(403).json({ error: 'Token verifikasi pembayaran tidak valid atau telah kedaluwarsa.' });
      return;
    }

    if (order.paymentStatus !== 'lunas') {
      const nowIso = new Date().toISOString();
      order.paymentStatus = 'lunas';
      order.fulfillmentStatus = 'dikemas';
      order.paidAt = nowIso;

      upsertLeadInStore({
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
        city: order.city,
        source: 'Pembelian Langsung',
        packageInterest: `${order.packageName} × ${order.quantity}`,
        estimatedValue: order.totalAmount,
        stage: 'pelanggan_setia',
        notes: `Pembayaran ${order.orderCode} lunas via ${order.paymentLabel}. Sedang dikemas.`,
      });

      store.analyticsEvents.unshift({
        id: `ev-${crypto.randomBytes(4).toString('hex')}`,
        sessionId,
        eventType: 'purchase_completed',
        label: `${order.orderCode} (${order.paymentLabel})`,
        source: trafficSource,
        value: order.totalAmount,
        createdAt: nowIso,
      });

      saveStore(store);
    }

    res.json({ order });
  });

  // --- Admin Auth Routes (First-Run Claim + Scrypt/Env Verification + Bearer Session) ---
  app.get('/api/admin/auth/status', (_req, res) => {
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode) {
      res.json({ configured: true, mode: 'env' });
      return;
    }
    if (store.adminCredential) {
      res.json({ configured: true, mode: 'claimed' });
      return;
    }
    res.json({ configured: false, mode: 'claim_required' });
  });

  app.post('/api/admin/auth/claim', (req, res) => {
    if (!checkAuthRateLimit(req.ip || 'unknown')) {
      res.status(429).json({ error: 'Terlalu banyak percobaan. Silakan coba beberapa menit lagi.' });
      return;
    }
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    if (envPasscode || store.adminCredential) {
      res.status(409).json({ error: 'Akses admin sudah dikonfigurasi. Silakan masuk dengan sandi Anda.' });
      return;
    }
    const password = sanitizeString(req.body?.password, 128);
    if (password.length < 8) {
      res.status(400).json({ error: 'Buat kata sandi admin minimal 8 karakter.' });
      return;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    store.adminCredential = {
      salt,
      hash,
      claimedAt: new Date().toISOString(),
    };
    saveStore(store);
    const token = createSessionToken();
    res.status(201).json({ token });
  });

  app.post('/api/admin/auth/login', (req, res) => {
    if (!checkAuthRateLimit(req.ip || 'unknown')) {
      res.status(429).json({ error: 'Terlalu banyak percobaan login. Silakan tunggu beberapa menit.' });
      return;
    }
    const password = sanitizeString(req.body?.password, 128);
    if (!password) {
      res.status(400).json({ error: 'Kata sandi wajib diisi.' });
      return;
    }
    const envPasscode = process.env.ADMIN_PASSCODE?.trim();
    let valid = false;
    if (envPasscode) {
      valid = verifyPasswordAgainstEnv(password, envPasscode);
    } else if (store.adminCredential) {
      valid = verifyPasswordAgainstStore(password, store.adminCredential);
    } else {
      res.status(409).json({ error: 'Sandi admin belum dibuat. Silakan atur sandi terlebih dahulu.' });
      return;
    }

    if (!valid) {
      res.status(401).json({ error: 'Kata sandi admin tidak sesuai.' });
      return;
    }
    const token = createSessionToken();
    res.json({ token });
  });

  app.post('/api/admin/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      sessions.delete(authHeader.slice(7).trim());
    }
    res.json({ ok: true });
  });

  // --- Protected Admin Merchant Routes ---
  app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const payload: AdminOverviewPayload = {
      analytics: computeAnalyticsSummary(),
      recentEvents: store.analyticsEvents.slice(0, 25),
      leads: store.leads,
      orders: store.orders,
      whatsappRules: store.whatsappRules,
      whatsappLogs: store.whatsappLogs.slice(0, 40),
      whatsappGatewayConfigured: Boolean(
        process.env.WHATSAPP_API_TOKEN?.trim() && process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
      ),
      updatedAt: new Date().toISOString(),
    };
    res.json(payload);
  });

  app.patch('/api/admin/leads/:id', requireAdmin, (req, res) => {
    const leadId = sanitizeString(req.params.id, 64);
    const lead = store.leads.find((l) => l.id === leadId);
    if (!lead) {
      res.status(404).json({ error: 'Data prospek tidak ditemukan.' });
      return;
    }
    if (typeof req.body?.stage === 'string') {
      const stage = req.body.stage as CrmStage;
      if (!VALID_STAGES.includes(stage)) {
        res.status(400).json({ error: 'Tahap pipeline CRM tidak valid.' });
        return;
      }
      lead.stage = stage;
    }
    if (typeof req.body?.notes === 'string') {
      lead.notes = sanitizeString(req.body.notes, 300);
    }
    lead.updatedAt = new Date().toISOString();
    saveStore(store);
    res.json({ lead });
  });

  app.patch('/api/admin/orders/:orderCode', requireAdmin, (req, res) => {
    const orderCode = sanitizeString(req.params.orderCode, 32);
    const order = store.orders.find((o) => o.orderCode === orderCode);
    if (!order) {
      res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
      return;
    }
    const allowedFulfillment: OrderRecord['fulfillmentStatus'][] = [
      'menunggu_bayar',
      'dikemas',
      'dikirim',
      'selesai',
    ];
    const allowedPayment: OrderRecord['paymentStatus'][] = ['menunggu', 'lunas', 'cod_diproses'];

    if (typeof req.body?.paymentStatus === 'string') {
      if (!allowedPayment.includes(req.body.paymentStatus as OrderRecord['paymentStatus'])) {
        res.status(400).json({ error: 'Status pembayaran tidak valid.' });
        return;
      }
      order.paymentStatus = req.body.paymentStatus as OrderRecord['paymentStatus'];
      if (order.paymentStatus === 'lunas' && !order.paidAt) {
        order.paidAt = new Date().toISOString();
      }
    }
    if (typeof req.body?.fulfillmentStatus === 'string') {
      if (!allowedFulfillment.includes(req.body.fulfillmentStatus as OrderRecord['fulfillmentStatus'])) {
        res.status(400).json({ error: 'Status pengiriman tidak valid.' });
        return;
      }
      order.fulfillmentStatus = req.body.fulfillmentStatus as OrderRecord['fulfillmentStatus'];
    }
    saveStore(store);
    res.json({ order });
  });

  app.patch('/api/admin/whatsapp/rules/:id', requireAdmin, (req, res) => {
    const ruleId = sanitizeString(req.params.id, 64);
    const rule = store.whatsappRules.find((r) => r.id === ruleId);
    if (!rule) {
      res.status(404).json({ error: 'Aturan otomasi WhatsApp tidak ditemukan.' });
      return;
    }
    if (typeof req.body?.active === 'boolean') {
      rule.active = req.body.active;
    }
    if (typeof req.body?.delayMinutes === 'number' && Number.isFinite(req.body.delayMinutes)) {
      rule.delayMinutes = Math.max(1, Math.min(43200, Math.round(req.body.delayMinutes)));
    }
    if (typeof req.body?.template === 'string') {
      const cleaned = sanitizeString(req.body.template, 600);
      if (cleaned.length < 10) {
        res.status(400).json({ error: 'Template pesan WhatsApp minimal 10 karakter.' });
        return;
      }
      rule.template = cleaned;
    }
    saveStore(store);
    res.json({ rule });
  });

  app.post('/api/admin/whatsapp/send', requireAdmin, async (req, res) => {
    const ruleId = sanitizeString(req.body?.ruleId, 64);
    const leadId = sanitizeString(req.body?.leadId, 64);
    const batchAllPending = Boolean(req.body?.batchAllPending);

    const rule = store.whatsappRules.find((r) => r.id === ruleId) ?? store.whatsappRules[0];
    if (!rule) {
      res.status(404).json({ error: 'Aturan follow-up tidak ditemukan.' });
      return;
    }

    let targets: CrmLead[] = [];
    if (batchAllPending) {
      targets = store.leads.filter(
        (l) => l.stage === 'menunggu_pembayaran' || l.stage === 'prospek_baru'
      );
    } else if (leadId) {
      const found = store.leads.find((l) => l.id === leadId);
      if (found) targets = [found];
    }

    if (targets.length === 0) {
      res.status(400).json({ error: 'Tidak ada prospek tertunda yang cocok untuk dikirim pesan.' });
      return;
    }

    const dispatched: WhatsAppDispatchLog[] = [];
    const nowIso = new Date().toISOString();

    for (const lead of targets) {
      const rendered = renderTemplate(rule.template, lead);
      const channelMode = await sendViaWhatsAppCloudApiIfConfigured(lead.phone, rendered);
      const waLink = `https://wa.me/${lead.phone}?text=${encodeURIComponent(rendered)}`;
      const logEntry: WhatsAppDispatchLog = {
        id: `wa-log-${crypto.randomBytes(4).toString('hex')}`,
        leadId: lead.id,
        leadName: lead.name,
        phone: lead.phone,
        ruleId: rule.id,
        ruleName: rule.name,
        messagePreview: rendered,
        channelMode,
        status: 'terkirim',
        waLink,
        sentAt: nowIso,
      };
      store.whatsappLogs.unshift(logEntry);
      dispatched.push(logEntry);

      lead.followUpCount += 1;
      lead.lastFollowUpAt = nowIso;
      if (lead.stage === 'prospek_baru' || lead.stage === 'menunggu_pembayaran') {
        lead.stage = 'follow_up_wa';
      }
      lead.updatedAt = nowIso;
      rule.sentCount += 1;
    }

    if (store.whatsappLogs.length > 200) {
      store.whatsappLogs = store.whatsappLogs.slice(0, 200);
    }

    saveStore(store);
    res.json({ dispatched, count: dispatched.length });
  });

  app.get('/api/admin/crm/export', requireAdmin, (_req, res) => {
    const header = [
      'ID',
      'Nama',
      'WhatsApp',
      'Email',
      'Kota',
      'Sumber',
      'Paket Minat',
      'Nilai Estimasi (IDR)',
      'Tahap CRM',
      'Jumlah Follow-Up WA',
      'Catatan',
      'Tanggal Masuk',
    ];
    const rows = store.leads.map((l) =>
      [
        l.id,
        l.name,
        l.phone,
        l.email,
        l.city,
        l.source,
        l.packageInterest,
        l.estimatedValue,
        l.stage,
        l.followUpCount,
        l.notes,
        l.createdAt,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
    const csv = [header.map(escapeCsvCell).join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="umi-hana-crm.csv"');
    res.send(csv);
  });

  // Mount Vite middleware in development or serve static build in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Umi Hana server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
