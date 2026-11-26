export type PackageId = 'coba-3' | 'keluarga-6' | 'reseller-15';

export type PaymentMethodId = 'qris' | 'va_bca' | 'va_mandiri' | 'va_bni' | 'ewallet_gopay' | 'cod';

export type ShippingMethodId = 'reguler' | 'kilat';

export type CrmStage =
  | 'prospek_baru'
  | 'menunggu_pembayaran'
  | 'follow_up_wa'
  | 'pelanggan_setia'
  | 'tidak_aktif';

export type AnalyticsEventType =
  | 'page_view'
  | 'view_pricing'
  | 'cta_click'
  | 'checkout_start'
  | 'checkout_abandoned'
  | 'lead_captured'
  | 'purchase_completed'
  | 'whatsapp_click';

export interface ProductPackage {
  id: PackageId;
  name: string;
  audience: string;
  packCount: number;
  weightGrams: number;
  price: number;
  compareAtPrice: number;
  pricePerPack: number;
  freeShipping: boolean;
  recommended: boolean;
  summary: string;
  highlights: string[];
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  city: string;
  avatar: string;
  segment: 'Keluarga' | 'Kantor & Hampers' | 'Reseller';
  packageBought: string;
  quote: string;
  outcome: string;
  verifiedDate: string;
}

export interface OrderRecord {
  orderCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  city: string;
  postalCode: string;
  packageId: PackageId;
  packageName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  shippingMethod: ShippingMethodId;
  paymentMethod: PaymentMethodId;
  paymentLabel: string;
  paymentCode: string;
  paymentStatus: 'menunggu' | 'lunas' | 'cod_diproses';
  fulfillmentStatus: 'menunggu_bayar' | 'dikemas' | 'dikirim' | 'selesai';
  createdAt: string;
  paidAt?: string;
}

export interface CrmLead {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  source: 'Checkout Tertunda' | 'Form Konsultasi' | 'Pembelian Langsung' | 'Tombol WhatsApp';
  packageInterest: string;
  estimatedValue: number;
  stage: CrmStage;
  notes: string;
  followUpCount: number;
  lastFollowUpAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppRule {
  id: string;
  name: string;
  triggerLabel: string;
  delayMinutes: number;
  targetStages: CrmStage[];
  active: boolean;
  template: string;
  sentCount: number;
}

export interface WhatsAppDispatchLog {
  id: string;
  leadId: string;
  leadName: string;
  phone: string;
  ruleId: string;
  ruleName: string;
  messagePreview: string;
  channelMode: 'cloud_api' | 'wa_me_queue';
  status: 'terkirim' | 'siap_kirim';
  waLink: string;
  sentAt: string;
}

export interface AnalyticsEventRecord {
  id: string;
  sessionId: string;
  eventType: AnalyticsEventType;
  label: string;
  source: string;
  value?: number;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalVisitors: number;
  totalPageViews: number;
  ctaClicks: number;
  whatsappClicks: number;
  checkoutStarts: number;
  leadsCaptured: number;
  completedPurchases: number;
  conversionRate: number;
  checkoutCompletionRate: number;
  totalRevenue: number;
  averageOrderValue: number;
  pendingRecoveryValue: number;
  funnel: Array<{
    step: string;
    count: number;
    rateFromPrevious: number;
  }>;
  trafficSources: Array<{
    source: string;
    sessions: number;
    conversions: number;
    rate: number;
  }>;
  dailyTrend: Array<{
    label: string;
    visitors: number;
    orders: number;
    revenue: number;
  }>;
}

export interface AdminOverviewPayload {
  analytics: AnalyticsSummary;
  recentEvents: AnalyticsEventRecord[];
  leads: CrmLead[];
  orders: OrderRecord[];
  whatsappRules: WhatsAppRule[];
  whatsappLogs: WhatsAppDispatchLog[];
  whatsappGatewayConfigured: boolean;
  updatedAt: string;
}

export interface OrderTrackingMilestone {
  id: string;
  title: string;
  detail: string;
  timestamp: string | null;
  status: 'completed' | 'current' | 'upcoming';
}

export interface OrderTrackingResult {
  orderCode: string;
  recipientLabel: string;
  city: string;
  packageName: string;
  quantity: number;
  shippingMethod: ShippingMethodId;
  estimatedDeliveryLabel: string;
  paymentLabel: string;
  paymentStatus: OrderRecord['paymentStatus'];
  fulfillmentStatus: OrderRecord['fulfillmentStatus'];
  totalAmount: number;
  createdAt: string;
  paidAt?: string;
  crmStage: CrmStage | null;
  crmSource: CrmLead['source'] | null;
  crmUpdatedAt: string | null;
  crmFollowUpCount: number;
  lastWhatsappUpdateAt: string | null;
  milestones: OrderTrackingMilestone[];
}


