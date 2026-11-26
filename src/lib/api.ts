import type {
  AdminOverviewPayload,
  AnalyticsEventType,
  CrmLead,
  CrmStage,
  OrderRecord,
  OrderTrackingResult,
  PackageId,
  PaymentMethodId,
  ShippingMethodId,
  WhatsAppDispatchLog,
  WhatsAppRule,
} from '../types.ts';

function getSessionId(): string {
  const key = 'umi_hana_session_id';
  try {
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;
    const generated = `sess_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    window.sessionStorage.setItem(key, generated);
    return generated;
  } catch {
    return `sess_${Date.now().toString(36)}`;
  }
}

function getTrafficSource(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = params.get('utm_source');
    if (utm && utm.trim().length > 0) return utm.trim().slice(0, 40);
    if (document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host.includes('instagram')) return 'Instagram Ads';
      if (host.includes('google')) return 'Google Search';
      if (host.includes('tiktok')) return 'TikTok Shop';
      if (host.includes('wa.me') || host.includes('whatsapp')) return 'WhatsApp Broadcast';
      return host.slice(0, 40);
    }
  } catch {
    // Fallback to Direct
  }
  return 'Direct / Organik';
}

export async function trackAnalyticsEvent(
  eventType: AnalyticsEventType,
  label: string,
  value?: number
): Promise<void> {
  try {
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        sessionId: getSessionId(),
        eventType,
        label,
        source: getTrafficSource(),
        value,
      }),
    });
  } catch {
    // Analytics must never interrupt shopper UX
  }
}

export async function fetchPublicSummary(): Promise<{
  packsDelivered: number;
  activeCustomers: number;
  averageRating: number;
}> {
  const res = await fetch('/api/public/summary');
  if (!res.ok) {
    throw new Error('Gagal memuat ringkasan produk.');
  }
  return res.json();
}

export async function submitLead(payload: {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  source: CrmLead['source'];
  packageInterest: string;
  estimatedValue?: number;
  notes?: string;
}): Promise<{ lead: CrmLead; scheduledFollowUp: WhatsAppDispatchLog | null }> {
  const res = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      sessionId: getSessionId(),
      trafficSource: getTrafficSource(),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal menyimpan data prospek.');
  }
  return data;
}

export async function createOrder(payload: {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  address: string;
  city: string;
  postalCode: string;
  packageId: PackageId;
  quantity: number;
  shippingMethod: ShippingMethodId;
  paymentMethod: PaymentMethodId;
}): Promise<{ order: OrderRecord; checkoutToken: string }> {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      sessionId: getSessionId(),
      trafficSource: getTrafficSource(),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal membuat pesanan.');
  }
  return data;
}

export async function confirmOrderPayment(
  orderCode: string,
  checkoutToken: string
): Promise<{ order: OrderRecord }> {
  const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      checkoutToken,
      sessionId: getSessionId(),
      trafficSource: getTrafficSource(),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal memverifikasi pembayaran.');
  }
  return data;
}

export async function trackOrderByCode(orderCode: string): Promise<OrderTrackingResult> {
  const cleaned = orderCode.trim();
  const res = await fetch(`/api/orders/track/${encodeURIComponent(cleaned)}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal melacak pesanan.');
  }
  return data.tracking as OrderTrackingResult;
}

export async function fetchAdminAuthStatus(): Promise<{
  configured: boolean;
  mode: 'env' | 'claimed' | 'claim_required';
}> {
  const res = await fetch('/api/admin/auth/status');
  if (!res.ok) {
    throw new Error('Gagal memeriksa status autentikasi.');
  }
  return res.json();
}

export async function claimAdminPassword(password: string): Promise<{ token: string }> {
  const res = await fetch('/api/admin/auth/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal mengatur kata sandi admin.');
  }
  return data;
}

export async function loginAdmin(password: string): Promise<{ token: string }> {
  const res = await fetch('/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Kata sandi admin tidak sesuai.');
  }
  return data;
}

export async function logoutAdmin(token: string): Promise<void> {
  await fetch('/api/admin/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

export async function fetchAdminOverview(token: string): Promise<AdminOverviewPayload> {
  const res = await fetch('/api/admin/overview', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal memuat data dashboard.');
  }
  return data;
}

export async function updateLeadStage(
  token: string,
  leadId: string,
  patch: { stage?: CrmStage; notes?: string }
): Promise<{ lead: CrmLead }> {
  const res = await fetch(`/api/admin/leads/${encodeURIComponent(leadId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal memperbarui prospek CRM.');
  }
  return data;
}

export async function updateOrderFulfillment(
  token: string,
  orderCode: string,
  patch: { fulfillmentStatus?: OrderRecord['fulfillmentStatus']; paymentStatus?: OrderRecord['paymentStatus'] }
): Promise<{ order: OrderRecord }> {
  const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderCode)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal memperbarui status pesanan.');
  }
  return data;
}

export async function updateWhatsAppRule(
  token: string,
  ruleId: string,
  patch: Partial<Pick<WhatsAppRule, 'active' | 'delayMinutes' | 'template'>>
): Promise<{ rule: WhatsAppRule }> {
  const res = await fetch(`/api/admin/whatsapp/rules/${encodeURIComponent(ruleId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal menyimpan aturan WhatsApp.');
  }
  return data;
}

export async function dispatchWhatsAppFollowUp(
  token: string,
  payload: { leadId?: string; ruleId: string; batchAllPending?: boolean }
): Promise<{ dispatched: WhatsAppDispatchLog[]; count: number }> {
  const res = await fetch('/api/admin/whatsapp/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Gagal mengirim follow-up WhatsApp.');
  }
  return data;
}

export async function downloadCrmCsv(token: string): Promise<void> {
  const res = await fetch('/api/admin/crm/export', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error('Gagal mengekspor data CRM.');
  }
  const csvText = await res.text();
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `umi-hana-crm-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
