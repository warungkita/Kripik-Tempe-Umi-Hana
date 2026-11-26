import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Check,
  CreditCard,
  Download,
  ExternalLink,
  Lock,
  LogOut,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { formatRupiah } from '../data/catalog.ts';
import {
  claimAdminPassword,
  dispatchWhatsAppFollowUp,
  downloadCrmCsv,
  fetchAdminAuthStatus,
  fetchAdminOverview,
  loginAdmin,
  logoutAdmin,
  updateLeadStage,
  updateOrderFulfillment,
  updateWhatsAppRule,
} from '../lib/api.ts';
import type {
  AdminOverviewPayload,
  CrmLead,
  CrmStage,
  OrderRecord,
  WhatsAppRule,
} from '../types.ts';

type DashboardTab = 'analytics' | 'crm' | 'whatsapp' | 'orders';

interface MerchantDashboardProps {
  adminToken: string | null;
  onSetAdminToken: (token: string | null) => void;
  onBackToStorefront: () => void;
  onNotify: (message: string) => void;
}

const STAGE_LABELS: Record<CrmStage, string> = {
  prospek_baru: 'Prospek Baru',
  menunggu_pembayaran: 'Menunggu Pembayaran',
  follow_up_wa: 'Follow-Up WA',
  pelanggan_setia: 'Pelanggan Setia',
  tidak_aktif: 'Tidak Aktif',
};

const STAGE_TEXT_COLORS: Record<CrmStage, string> = {
  prospek_baru: 'text-[#1D4ED8]',
  menunggu_pembayaran: 'text-[#B45309]',
  follow_up_wa: 'text-[#0F766E]',
  pelanggan_setia: 'text-[#1B6B3A]',
  tidak_aktif: 'text-[#6B7280]',
};

const EVENT_LABELS: Record<string, string> = {
  page_view: 'Kunjungan Halaman',
  view_pricing: 'Melihat Paket Harga',
  cta_click: 'Klik Tombol CTA',
  checkout_start: 'Mulai Checkout',
  checkout_abandoned: 'Checkout Tertunda',
  lead_captured: 'Prospek Masuk CRM',
  purchase_completed: 'Transaksi Selesai',
  whatsapp_click: 'Klik WhatsApp',
};

function formatShortTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function MerchantDashboard({
  adminToken,
  onSetAdminToken,
  onBackToStorefront,
  onNotify,
}: MerchantDashboardProps) {
  const [authMode, setAuthMode] = useState<'loading' | 'claim_required' | 'login'>('loading');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState<DashboardTab>('analytics');
  const [data, setData] = useState<AdminOverviewPayload | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // CRM filters & inline note editing
  const [crmSearch, setCrmSearch] = useState('');
  const [crmStageFilter, setCrmStageFilter] = useState<'all' | CrmStage>('all');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // WhatsApp automation editing
  const [selectedRuleId, setSelectedRuleId] = useState<string>('wa-rule-15m');
  const [ruleDrafts, setRuleDrafts] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [latestDispatchedLink, setLatestDispatchedLink] = useState<{
    name: string;
    waLink: string;
  } | null>(null);

  useEffect(() => {
    if (adminToken) return;
    let cancelled = false;
    fetchAdminAuthStatus()
      .then((status) => {
        if (cancelled) return;
        setAuthMode(status.mode === 'claim_required' ? 'claim_required' : 'login');
      })
      .catch(() => {
        if (!cancelled) setAuthMode('login');
      });
    return () => {
      cancelled = true;
    };
  }, [adminToken]);

  const loadOverview = useCallback(
    async (silent = false) => {
      if (!adminToken) return;
      if (!silent) setLoadingData(true);
      setDataError(null);
      try {
        const overview = await fetchAdminOverview(adminToken);
        setData(overview);
        setRuleDrafts((prev) => {
          const next = { ...prev };
          for (const rule of overview.whatsappRules) {
            if (next[rule.id] === undefined) {
              next[rule.id] = rule.template;
            }
          }
          return next;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal memuat data dashboard.';
        if (msg.includes('Sesi admin')) {
          onSetAdminToken(null);
        } else {
          setDataError(msg);
        }
      } finally {
        if (!silent) setLoadingData(false);
      }
    },
    [adminToken, onSetAdminToken]
  );

  useEffect(() => {
    if (!adminToken) return;
    void loadOverview(false);
    const interval = window.setInterval(() => {
      void loadOverview(true);
    }, 15000);
    return () => window.clearInterval(interval);
  }, [adminToken, loadOverview]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (authMode === 'claim_required') {
      if (passwordInput.length < 8) {
        setAuthError('Kata sandi admin minimal 8 karakter.');
        return;
      }
      if (passwordInput !== confirmPasswordInput) {
        setAuthError('Konfirmasi kata sandi tidak cocok.');
        return;
      }
    }
    setAuthSubmitting(true);
    try {
      const result =
        authMode === 'claim_required'
          ? await claimAdminPassword(passwordInput)
          : await loginAdmin(passwordInput);
      onSetAdminToken(result.token);
      setPasswordInput('');
      setConfirmPasswordInput('');
      onNotify('Berhasil masuk ke Dashboard Pemilik Umi Hana.');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Autentikasi gagal.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (adminToken) {
      await logoutAdmin(adminToken);
    }
    onSetAdminToken(null);
    setData(null);
    onNotify('Anda telah keluar dari sesi admin.');
  };

  const handleStageChange = async (leadId: string, stage: CrmStage) => {
    if (!adminToken) return;
    setBusyAction(`lead-${leadId}`);
    try {
      await updateLeadStage(adminToken, leadId, { stage });
      await loadOverview(true);
      onNotify(`Tahap CRM diperbarui ke ${STAGE_LABELS[stage]}.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal memperbarui tahap CRM.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveNote = async (leadId: string) => {
    if (!adminToken) return;
    setBusyAction(`note-${leadId}`);
    try {
      await updateLeadStage(adminToken, leadId, { notes: editingNoteText });
      setEditingNoteId(null);
      await loadOverview(true);
      onNotify('Catatan prospek disimpan.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menyimpan catatan.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleOrderUpdate = async (
    orderCode: string,
    patch: { fulfillmentStatus?: OrderRecord['fulfillmentStatus']; paymentStatus?: OrderRecord['paymentStatus'] }
  ) => {
    if (!adminToken) return;
    setBusyAction(`ord-${orderCode}`);
    try {
      await updateOrderFulfillment(adminToken, orderCode, patch);
      await loadOverview(true);
      onNotify(`Status pesanan ${orderCode} diperbarui.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal memperbarui pesanan.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleRule = async (rule: WhatsAppRule) => {
    if (!adminToken) return;
    setBusyAction(`rule-${rule.id}`);
    try {
      await updateWhatsAppRule(adminToken, rule.id, { active: !rule.active });
      await loadOverview(true);
      onNotify(`Aturan "${rule.name}" ${!rule.active ? 'diaktifkan' : 'dinonaktifkan'}.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal mengubah status aturan.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveRuleTemplate = async (ruleId: string) => {
    if (!adminToken) return;
    const draft = ruleDrafts[ruleId];
    if (!draft || draft.trim().length < 10) {
      onNotify('Template pesan minimal 10 karakter.');
      return;
    }
    setBusyAction(`save-rule-${ruleId}`);
    try {
      await updateWhatsAppRule(adminToken, ruleId, { template: draft.trim() });
      await loadOverview(true);
      onNotify('Template pesan otomasi WhatsApp tersimpan.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal menyimpan template.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendSingleFollowUp = async (lead: CrmLead) => {
    if (!adminToken) return;
    setBusyAction(`wa-${lead.id}`);
    try {
      const res = await dispatchWhatsAppFollowUp(adminToken, {
        leadId: lead.id,
        ruleId: selectedRuleId,
      });
      await loadOverview(true);
      const first = res.dispatched[0];
      if (first) {
        setLatestDispatchedLink({ name: first.leadName, waLink: first.waLink });
      }
      onNotify(`Follow-up WhatsApp untuk ${lead.name} berhasil dicatat.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal mengirim follow-up WhatsApp.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleBatchFollowUp = async () => {
    if (!adminToken) return;
    setBusyAction('wa-batch');
    try {
      const res = await dispatchWhatsAppFollowUp(adminToken, {
        ruleId: selectedRuleId,
        batchAllPending: true,
      });
      await loadOverview(true);
      onNotify(`Berhasil memproses ${res.count} pesan follow-up prospek tertunda.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Tidak ada prospek tertunda saat ini.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportCsv = async () => {
    if (!adminToken) return;
    try {
      await downloadCrmCsv(adminToken);
      onNotify('Berkas CSV CRM berhasil diunduh.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Gagal mengekspor CSV.');
    }
  };

  const filteredLeads = useMemo(() => {
    if (!data) return [];
    const q = crmSearch.trim().toLowerCase();
    return data.leads.filter((lead) => {
      if (crmStageFilter !== 'all' && lead.stage !== crmStageFilter) return false;
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.phone.toLowerCase().includes(q) ||
        lead.city.toLowerCase().includes(q) ||
        lead.packageInterest.toLowerCase().includes(q)
      );
    });
  }, [data, crmSearch, crmStageFilter]);

  const pendingFollowUpLeads = useMemo(() => {
    if (!data) return [];
    return data.leads.filter(
      (l) => l.stage === 'menunggu_pembayaran' || l.stage === 'prospek_baru'
    );
  }, [data]);

  const selectedRule = useMemo(() => {
    if (!data) return null;
    return data.whatsappRules.find((r) => r.id === selectedRuleId) ?? data.whatsappRules[0] ?? null;
  }, [data, selectedRuleId]);

  // --- AUTH GATE VIEW ---
  if (!adminToken) {
    return (
      <main className="min-h-[calc(100vh-64px)] bg-[#F7F8F5] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white border border-[#E4E7DF] rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#1B6B3A]">
              <Lock className="w-4 h-4" />
              Portal Pemilik Toko · PT Hana Food Indonesia
            </div>
            <h1 className="font-display text-2xl font-bold text-[#141A15]">
              {authMode === 'claim_required'
                ? 'Atur Kata Sandi Dashboard Admin'
                : 'Masuk ke Dashboard CRM & Analitik'}
            </h1>
            <p className="text-sm text-[#525C53] leading-relaxed">
              {authMode === 'claim_required'
                ? 'Pengaturan satu kali untuk melindungi data pelanggan CRM, metrik konversi real-time, dan kontrol otomasi WhatsApp.'
                : 'Masukkan kata sandi admin Anda untuk memantau konversi real-time, mengelola prospek CRM, dan menjalankan follow-up WhatsApp.'}
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="px-4 py-3 text-sm text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-lg"
            >
              {authError}
            </div>
          )}

          {authMode === 'loading' ? (
            <div className="py-8 text-center text-sm text-[#525C53]">Memeriksa status keamanan...</div>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label htmlFor="admin-pass" className="block text-xs font-medium text-[#525C53] mb-1">
                  {authMode === 'claim_required' ? 'Buat Kata Sandi Admin (min. 8 karakter)' : 'Kata Sandi Admin'}
                </label>
                <input
                  id="admin-pass"
                  type="password"
                  required
                  minLength={authMode === 'claim_required' ? 8 : 1}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D4D9CD] rounded-lg focus:outline-none focus:border-[#1B6B3A]"
                />
              </div>

              {authMode === 'claim_required' && (
                <div>
                  <label htmlFor="admin-pass-confirm" className="block text-xs font-medium text-[#525C53] mb-1">
                    Ulangi Kata Sandi Admin
                  </label>
                  <input
                    id="admin-pass-confirm"
                    type="password"
                    required
                    minLength={8}
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 text-sm border border-[#D4D9CD] rounded-lg focus:outline-none focus:border-[#1B6B3A]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full px-5 py-3 text-sm font-semibold text-white bg-[#1B6B3A] hover:bg-[#14532D] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                {authSubmitting
                  ? 'Memverifikasi...'
                  : authMode === 'claim_required'
                    ? 'Simpan Sandi & Buka Dashboard'
                    : 'Masuk Dashboard'}
              </button>

              <button
                type="button"
                onClick={onBackToStorefront}
                className="w-full px-5 py-2.5 text-sm font-medium text-[#525C53] hover:text-[#141A15] border border-[#E4E7DF] rounded-lg transition-colors cursor-pointer"
              >
                Kembali ke Landing Page
              </button>
            </form>
          )}
        </div>
      </main>
    );
  }

  const navItems: Array<{ id: DashboardTab; label: string; icon: typeof BarChart3; count?: number }> = [
    { id: 'analytics', label: 'Analitik Konversi', icon: BarChart3 },
    { id: 'crm', label: 'CRM & Pelanggan', icon: Users, count: data?.leads.length },
    { id: 'whatsapp', label: 'Otomasi WhatsApp', icon: MessageSquare, count: pendingFollowUpLeads.length },
    { id: 'orders', label: 'Transaksi & Bayar', icon: CreditCard, count: data?.orders.length },
  ];

  const activeTabTitle = navItems.find((n) => n.id === activeTab)?.label ?? 'Dashboard';

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F7F8F5] flex flex-col lg:flex-row">
      {/* Sidebar (256px on Desktop) */}
      <aside className="lg:w-64 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-[#E4E7DF] p-4 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="px-2 pt-1">
            <div className="text-xs font-medium text-[#525C53]">Pusat Konversi &amp; CRM</div>
            <div className="font-display text-lg font-bold text-[#141A15] mt-0.5">Umi Hana Admin</div>
          </div>

          <nav aria-label="Menu Dashboard" className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#141A15] text-white'
                      : 'text-[#525C53] hover:bg-[#F7F8F5] hover:text-[#141A15]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </span>
                  {item.count !== undefined && (
                    <span
                      className={`font-mono-tabular text-xs ${
                        isActive ? 'text-white/80' : 'text-[#7A847B]'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:flex flex-col gap-2 pt-4 mt-6 border-t border-[#E4E7DF]">
          <button
            type="button"
            onClick={onBackToStorefront}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#525C53] hover:text-[#141A15] hover:bg-[#F7F8F5] rounded-lg transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Lihat Landing Page
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#991B1B] hover:bg-[#FEF2F2] rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar Sesi Admin
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0">
        {/* Contextual Workspace Breadcrumb Header */}
        <div className="bg-white border-b border-[#E4E7DF] px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-[#525C53] flex items-center gap-2">
            <span>Umi Hana</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-[#141A15]">{activeTabTitle}</span>
            {data && (
              <span className="hidden sm:inline text-xs text-[#7A847B] font-mono-tabular ml-2">
                Diperbarui {formatShortTime(data.updatedAt)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void loadOverview(false)}
              disabled={loadingData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#141A15] bg-white border border-[#D4D9CD] hover:bg-[#F7F8F5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              Perbarui Data
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#991B1B] border border-[#FECACA] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </div>

        {/* Viewport Body */}
        <div className="p-4 sm:p-8 max-w-[1200px] space-y-6">
          {dataError && (
            <div className="px-4 py-3 text-sm text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-lg">
              {dataError}
            </div>
          )}

          {!data && loadingData ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 bg-white border border-[#E4E7DF] rounded-xl p-5 animate-pulse" />
              ))}
            </div>
          ) : data ? (
            <>
              {/* TAB 1: REAL-TIME CONVERSION ANALYTICS */}
              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  {/* 4 KPI Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border border-[#E4E7DF] rounded-xl p-5">
                      <div className="text-xs text-[#525C53]">Pengunjung Unik &amp; Sesi</div>
                      <div className="font-mono-tabular text-2xl font-bold text-[#141A15] mt-1.5">
                        {data.analytics.totalVisitors.toLocaleString('id-ID')}
                      </div>
                      <div className="text-xs text-[#525C53] mt-1 font-mono-tabular">
                        {data.analytics.totalPageViews} total tayangan halaman
                      </div>
                    </div>

                    <div className="bg-white border border-[#E4E7DF] rounded-xl p-5">
                      <div className="text-xs text-[#525C53]">Tingkat Konversi Pembelian</div>
                      <div className="font-mono-tabular text-2xl font-bold text-[#1B6B3A] mt-1.5">
                        {data.analytics.conversionRate}%
                      </div>
                      <div className="text-xs text-[#525C53] mt-1 font-mono-tabular">
                        Penyelesaian checkout: {data.analytics.checkoutCompletionRate}%
                      </div>
                    </div>

                    <div className="bg-white border border-[#E4E7DF] rounded-xl p-5">
                      <div className="text-xs text-[#525C53]">Total Pendapatan Terkonfirmasi</div>
                      <div className="font-mono-tabular text-2xl font-bold text-[#141A15] mt-1.5">
                        {formatRupiah(data.analytics.totalRevenue)}
                      </div>
                      <div className="text-xs text-[#525C53] mt-1 font-mono-tabular">
                        Rata-rata {formatRupiah(data.analytics.averageOrderValue)} / pesanan
                      </div>
                    </div>

                    <div className="bg-white border border-[#E4E7DF] rounded-xl p-5">
                      <div className="text-xs text-[#525C53]">Potensi Pemulihan WA (Tertunda)</div>
                      <div className="font-mono-tabular text-2xl font-bold text-[#B45309] mt-1.5">
                        {formatRupiah(data.analytics.pendingRecoveryValue)}
                      </div>
                      <div className="text-xs text-[#525C53] mt-1 font-mono-tabular">
                        {pendingFollowUpLeads.length} prospek · {data.analytics.whatsappClicks} klik WhatsApp
                      </div>
                    </div>
                  </div>

                  {/* Funnel & 6-Day Trend */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-6 bg-white border border-[#E4E7DF] rounded-xl p-6 space-y-5">
                      <div>
                        <h2 className="text-base font-semibold text-[#141A15]">Corong Konversi Real-Time</h2>
                        <p className="text-xs text-[#525C53] mt-0.5">
                          Perjalanan pengunjung dari halaman utama hingga pembayaran terverifikasi.
                        </p>
                      </div>

                      <div className="space-y-4">
                        {data.analytics.funnel.map((step, idx) => {
                          const maxVal = Math.max(data.analytics.funnel[0]?.count || 1, 1);
                          const pct = Math.max(8, Math.round((step.count / maxVal) * 100));
                          return (
                            <div key={step.step} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-[#141A15]">
                                  0{idx + 1}. {step.step}
                                </span>
                                <span className="font-mono-tabular text-[#525C53]">
                                  <strong className="text-[#141A15]">{step.count}</strong> · {step.rateFromPrevious}% dari tahap sebelumnya
                                </span>
                              </div>
                              <div className="h-2.5 w-full bg-[#F2F4EE] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#1B6B3A] rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 6-Day Bar Chart */}
                    <div className="lg:col-span-6 bg-white border border-[#E4E7DF] rounded-xl p-6 space-y-5">
                      <div>
                        <h2 className="text-base font-semibold text-[#141A15]">Tren Kunjungan &amp; Pesanan (6 Hari)</h2>
                        <p className="text-xs text-[#525C53] mt-0.5">
                          Perbandingan volume pengunjung harian terhadap transaksi terkonfirmasi.
                        </p>
                      </div>

                      <div className="grid grid-cols-6 gap-3 items-end h-44 pt-4">
                        {data.analytics.dailyTrend.map((day) => {
                          const maxVis = Math.max(...data.analytics.dailyTrend.map((d) => d.visitors), 1);
                          const visHeight = Math.max(12, Math.round((day.visitors / maxVis) * 100));
                          const ordHeight = Math.max(8, Math.round((day.orders / Math.max(maxVis * 0.25, 1)) * 100));
                          return (
                            <div key={day.label} className="flex flex-col items-center gap-2 h-full justify-end">
                              <div className="w-full flex items-end justify-center gap-1 h-28">
                                <div
                                  title={`${day.visitors} pengunjung`}
                                  className="w-3.5 bg-[#D9E2D4] rounded-t"
                                  style={{ height: `${Math.min(100, visHeight)}%` }}
                                />
                                <div
                                  title={`${day.orders} pesanan (${formatRupiah(day.revenue)})`}
                                  className="w-3.5 bg-[#1B6B3A] rounded-t"
                                  style={{ height: `${Math.min(100, ordHeight)}%` }}
                                />
                              </div>
                              <div className="text-center">
                                <div className="text-[11px] font-medium text-[#141A15] whitespace-nowrap">
                                  {day.label}
                                </div>
                                <div className="text-[10px] font-mono-tabular text-[#525C53]">
                                  {day.orders} ord
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-5 text-xs text-[#525C53] pt-2 border-t border-[#E4E7DF]">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-[#D9E2D4] inline-block" />
                          Pengunjung
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-[#1B6B3A] inline-block" />
                          Pesanan Lunas
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Traffic Sources & Live Event Stream */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#E4E7DF]">
                        <h2 className="text-sm font-semibold text-[#141A15]">Atribusi Sumber Trafik</h2>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#F7F8F5] text-[#525C53] border-b border-[#E4E7DF]">
                            <tr>
                              <th className="px-5 py-3 font-medium">Sumber</th>
                              <th className="px-4 py-3 font-medium text-right">Sesi</th>
                              <th className="px-4 py-3 font-medium text-right">Beli</th>
                              <th className="px-5 py-3 font-medium text-right">Konversi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E4E7DF]">
                            {data.analytics.trafficSources.map((row) => (
                              <tr key={row.source} className="hover:bg-[#F7F8F5]">
                                <td className="px-5 py-3 font-medium text-[#141A15]">{row.source}</td>
                                <td className="px-4 py-3 text-right font-mono-tabular">{row.sessions}</td>
                                <td className="px-4 py-3 text-right font-mono-tabular">{row.conversions}</td>
                                <td className="px-5 py-3 text-right font-mono-tabular font-semibold text-[#1B6B3A]">
                                  {row.rate}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="lg:col-span-7 bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#E4E7DF] flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-[#141A15]">Aktivitas Pengunjung Terbaru</h2>
                        <span className="text-xs text-[#525C53]">Otomatis diperbarui setiap 15 detik</span>
                      </div>
                      <div className="overflow-x-auto max-h-72 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#F7F8F5] text-[#525C53] border-b border-[#E4E7DF] sticky top-0">
                            <tr>
                              <th className="px-5 py-2.5 font-medium">Waktu</th>
                              <th className="px-4 py-2.5 font-medium">Event</th>
                              <th className="px-4 py-2.5 font-medium">Detail</th>
                              <th className="px-5 py-2.5 font-medium text-right">Nilai</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E4E7DF]">
                            {data.recentEvents.map((ev) => (
                              <tr key={ev.id} className="hover:bg-[#F7F8F5]">
                                <td className="px-5 py-2.5 font-mono-tabular text-[#525C53] whitespace-nowrap">
                                  {formatShortTime(ev.createdAt)}
                                </td>
                                <td className="px-4 py-2.5 font-medium text-[#141A15] whitespace-nowrap">
                                  {EVENT_LABELS[ev.eventType] || ev.eventType}
                                </td>
                                <td className="px-4 py-2.5 text-[#525C53] max-w-[200px] truncate">
                                  {ev.label} · {ev.source}
                                </td>
                                <td className="px-5 py-2.5 text-right font-mono-tabular text-[#141A15]">
                                  {ev.value ? formatRupiah(ev.value) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CRM & CUSTOMER PIPELINE */}
              {activeTab === 'crm' && (
                <div className="space-y-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 text-[#7A847B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={crmSearch}
                        onChange={(e) => setCrmSearch(e.target.value)}
                        placeholder="Cari nama, nomor WhatsApp, kota, atau paket..."
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-[#D4D9CD] rounded-lg focus:outline-none focus:border-[#1B6B3A]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleExportCsv()}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#141A15] bg-white border border-[#D4D9CD] hover:bg-[#F7F8F5] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        Ekspor CSV
                      </button>
                    </div>
                  </div>

                  {/* Stage Segmented Filter */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {(['all', 'menunggu_pembayaran', 'prospek_baru', 'follow_up_wa', 'pelanggan_setia', 'tidak_aktif'] as const).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setCrmStageFilter(st)}
                          className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            crmStageFilter === st
                              ? 'bg-[#141A15] text-white'
                              : 'bg-white border border-[#E4E7DF] text-[#525C53] hover:text-[#141A15]'
                          }`}
                        >
                          {st === 'all' ? `Semua (${data.leads.length})` : STAGE_LABELS[st]}
                        </button>
                      )
                    )}
                  </div>

                  {/* CRM Table */}
                  <div className="bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
                    {filteredLeads.length === 0 ? (
                      <div className="p-10 text-center space-y-2">
                        <p className="text-sm font-medium text-[#141A15]">Belum ada prospek yang cocok dengan filter ini.</p>
                        <p className="text-xs text-[#525C53]">
                          Setiap pengunjung yang mengisi formulir konsultasi atau memulai checkout otomatis muncul di sini.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#F7F8F5] text-[#525C53] border-b border-[#E4E7DF]">
                            <tr>
                              <th className="px-5 py-3 font-medium">Pelanggan &amp; WhatsApp</th>
                              <th className="px-4 py-3 font-medium">Sumber &amp; Paket</th>
                              <th className="px-4 py-3 font-medium text-right">Estimasi</th>
                              <th className="px-4 py-3 font-medium">Tahap Pipeline</th>
                              <th className="px-4 py-3 font-medium">Catatan CRM</th>
                              <th className="px-5 py-3 font-medium text-right">Tindak Lanjut</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E4E7DF]">
                            {filteredLeads.map((lead) => (
                              <tr key={lead.id} className="hover:bg-[#F7F8F5]/70 align-top">
                                <td className="px-5 py-3.5">
                                  <div className="font-semibold text-[#141A15] text-sm">{lead.name}</div>
                                  <div className="font-mono-tabular text-[#525C53] mt-0.5">
                                    +{lead.phone} · {lead.city}
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  <div className="font-medium text-[#141A15]">{lead.packageInterest}</div>
                                  <div className="text-[#525C53] mt-0.5">
                                    {lead.source} · {lead.followUpCount}× WA
                                  </div>
                                </td>
                                <td className="px-4 py-3.5 text-right font-mono-tabular font-semibold text-[#141A15] whitespace-nowrap">
                                  {formatRupiah(lead.estimatedValue)}
                                </td>
                                <td className="px-4 py-3.5">
                                  <select
                                    aria-label={`Ubah tahap CRM untuk ${lead.name}`}
                                    value={lead.stage}
                                    disabled={busyAction === `lead-${lead.id}`}
                                    onChange={(e) => void handleStageChange(lead.id, e.target.value as CrmStage)}
                                    className={`px-2.5 py-1.5 text-xs font-semibold bg-white border border-[#D4D9CD] rounded-md focus:outline-none focus:border-[#1B6B3A] ${STAGE_TEXT_COLORS[lead.stage]}`}
                                  >
                                    {(Object.keys(STAGE_LABELS) as CrmStage[]).map((stageKey) => (
                                      <option key={stageKey} value={stageKey}>
                                        {STAGE_LABELS[stageKey]}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-4 py-3.5 max-w-[240px]">
                                  {editingNoteId === lead.id ? (
                                    <div className="space-y-1.5">
                                      <input
                                        type="text"
                                        value={editingNoteText}
                                        onChange={(e) => setEditingNoteText(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border border-[#1B6B3A] rounded-md"
                                      />
                                      <div className="flex gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => void handleSaveNote(lead.id)}
                                          className="px-2.5 py-1 text-[11px] font-semibold bg-[#1B6B3A] text-white rounded cursor-pointer"
                                        >
                                          Simpan
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingNoteId(null)}
                                          className="px-2.5 py-1 text-[11px] text-[#525C53] border border-[#D4D9CD] rounded cursor-pointer"
                                        >
                                          Batal
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingNoteId(lead.id);
                                        setEditingNoteText(lead.notes);
                                      }}
                                      className="text-left text-[#525C53] hover:text-[#141A15] leading-relaxed cursor-pointer"
                                      title="Klik untuk mengedit catatan"
                                    >
                                      {lead.notes || 'Tambah catatan...'}
                                    </button>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    disabled={busyAction === `wa-${lead.id}`}
                                    onClick={() => void handleSendSingleFollowUp(lead)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1B6B3A] hover:bg-[#14532D] disabled:opacity-60 rounded-md transition-colors cursor-pointer"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    Follow-Up WA
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: WHATSAPP AUTOMATION */}
              {activeTab === 'whatsapp' && (
                <div className="space-y-6">
                  {/* Top action banner */}
                  <div className="bg-white border border-[#E4E7DF] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold text-[#141A15]">
                        Otomasi Follow-Up Prospek Belum Membeli
                      </h2>
                      <p className="text-xs text-[#525C53]">
                        Mode saluran:{' '}
                        <strong className="text-[#141A15]">
                          {data.whatsappGatewayConfigured
                            ? 'WhatsApp Cloud API Terhubung'
                            : 'Antrean WhatsApp Bisnis Siap Kirim (wa.me + Log Otomatis)'}
                        </strong>
                        {' · '}
                        {pendingFollowUpLeads.length} prospek menunggu tindak lanjut saat ini.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <select
                        aria-label="Pilih aturan pesan follow-up"
                        value={selectedRuleId}
                        onChange={(e) => setSelectedRuleId(e.target.value)}
                        className="px-3 py-2 text-xs font-medium bg-[#F7F8F5] border border-[#D4D9CD] rounded-lg"
                      >
                        {data.whatsappRules.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={busyAction === 'wa-batch' || pendingFollowUpLeads.length === 0}
                        onClick={() => void handleBatchFollowUp()}
                        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#1B6B3A] hover:bg-[#14532D] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Jalankan Follow-Up Semua ({pendingFollowUpLeads.length})
                      </button>
                    </div>
                  </div>

                  {latestDispatchedLink && (
                    <div className="bg-[#F4F8F5] border border-[#C6DFCE] rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-[#1B6B3A] font-medium">
                        <Check className="w-4 h-4" />
                        Pesan follow-up untuk {latestDispatchedLink.name} siap dibuka di WhatsApp.
                      </span>
                      <a
                        href={latestDispatchedLink.waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1B6B3A] hover:bg-[#14532D] rounded-lg"
                      >
                        Buka Chat WhatsApp
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}

                  {/* Unpaid Prospects Queue */}
                  <div className="bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#E4E7DF] flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[#141A15]">
                        Prospek Belum Membeli (Target Follow-Up)
                      </h3>
                      <span className="text-xs text-[#525C53] font-mono-tabular">
                        {pendingFollowUpLeads.length} kontak
                      </span>
                    </div>

                    {pendingFollowUpLeads.length === 0 ? (
                      <div className="p-8 text-center text-sm text-[#525C53]">
                        Seluruh prospek tertunda sudah ditindaklanjuti atau telah menyelesaikan pembelian.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#E4E7DF]">
                        {pendingFollowUpLeads.map((lead) => {
                          const preview = (selectedRule?.template || '')
                            .replace(/\{nama\}/gi, lead.name)
                            .replace(/\{paket\}/gi, lead.packageInterest)
                            .replace(/\{total\}/gi, formatRupiah(lead.estimatedValue));
                          const directWa = `https://wa.me/${lead.phone}?text=${encodeURIComponent(preview)}`;
                          return (
                            <div
                              key={lead.id}
                              className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                            >
                              <div className="space-y-1.5 max-w-2xl">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="text-sm font-semibold text-[#141A15]">{lead.name}</span>
                                  <span className="font-mono-tabular text-[#525C53]">+{lead.phone}</span>
                                  <span aria-hidden="true" className="text-[#C4CBC0]">·</span>
                                  <span className={STAGE_TEXT_COLORS[lead.stage] + ' font-semibold'}>
                                    {STAGE_LABELS[lead.stage]}
                                  </span>
                                  <span aria-hidden="true" className="text-[#C4CBC0]">·</span>
                                  <span className="font-mono-tabular text-[#141A15] font-medium">
                                    {formatRupiah(lead.estimatedValue)}
                                  </span>
                                </div>
                                <p className="text-xs text-[#525C53] bg-[#F7F8F5] border border-[#E4E7DF] rounded-lg p-3 leading-relaxed">
                                  {preview}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  disabled={busyAction === `wa-${lead.id}`}
                                  onClick={() => void handleSendSingleFollowUp(lead)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#1B6B3A] hover:bg-[#14532D] rounded-lg cursor-pointer"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  Catat &amp; Kirim
                                </button>
                                <a
                                  href={directWa}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#141A15] border border-[#D4D9CD] hover:bg-[#F7F8F5] rounded-lg"
                                >
                                  Buka WA
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Automation Workflow Rules */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-[#141A15]">
                      Alur &amp; Template Otomasi WhatsApp (Variabel: {'{nama}'}, {'{paket}'}, {'{total}'})
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {data.whatsappRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="bg-white border border-[#E4E7DF] rounded-xl p-5 flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-[#141A15]">{rule.name}</div>
                                <div className="text-xs text-[#525C53] mt-0.5">
                                  {rule.triggerLabel} ·{' '}
                                  <span className="font-mono-tabular">{rule.sentCount}× terkirim</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={busyAction === `rule-${rule.id}`}
                                onClick={() => void handleToggleRule(rule)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                  rule.active
                                    ? 'bg-[#F4F8F5] border-[#1B6B3A] text-[#1B6B3A]'
                                    : 'bg-[#F7F8F5] border-[#D4D9CD] text-[#525C53]'
                                }`}
                              >
                                {rule.active ? 'Aktif' : 'Nonaktif'}
                              </button>
                            </div>

                            <textarea
                              rows={3}
                              aria-label={`Template pesan untuk ${rule.name}`}
                              value={ruleDrafts[rule.id] ?? rule.template}
                              onChange={(e) =>
                                setRuleDrafts((prev) => ({ ...prev, [rule.id]: e.target.value }))
                              }
                              className="w-full px-3 py-2 text-xs text-[#141A15] bg-[#F7F8F5] border border-[#D4D9CD] rounded-lg focus:outline-none focus:bg-white focus:border-[#1B6B3A] leading-relaxed"
                            />
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              disabled={busyAction === `save-rule-${rule.id}`}
                              onClick={() => void handleSaveRuleTemplate(rule.id)}
                              className="px-3.5 py-1.5 text-xs font-semibold text-[#141A15] border border-[#D4D9CD] hover:bg-[#F7F8F5] rounded-lg transition-colors cursor-pointer"
                            >
                              Simpan Template
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dispatch Log History */}
                  <div className="bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#E4E7DF]">
                      <h3 className="text-sm font-semibold text-[#141A15]">Riwayat Pengiriman Follow-Up</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F7F8F5] text-[#525C53] border-b border-[#E4E7DF]">
                          <tr>
                            <th className="px-5 py-3 font-medium">Waktu</th>
                            <th className="px-4 py-3 font-medium">Prospek</th>
                            <th className="px-4 py-3 font-medium">Aturan</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-5 py-3 font-medium text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E7DF]">
                          {data.whatsappLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-[#F7F8F5]">
                              <td className="px-5 py-3 font-mono-tabular text-[#525C53] whitespace-nowrap">
                                {formatShortTime(log.sentAt)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-[#141A15]">{log.leadName}</div>
                                <div className="font-mono-tabular text-[#525C53]">+{log.phone}</div>
                              </td>
                              <td className="px-4 py-3 text-[#525C53]">{log.ruleName}</td>
                              <td className="px-4 py-3 font-semibold text-[#1B6B3A]">
                                {log.status === 'terkirim' ? 'Terkirim' : 'Siap Kirim'}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <a
                                  href={log.waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-medium text-[#1B6B3A] hover:underline"
                                >
                                  Buka Chat
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: ORDERS & INTEGRATED PAYMENTS */}
              {activeTab === 'orders' && (
                <div className="bg-white border border-[#E4E7DF] rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#E4E7DF] flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-[#141A15]">Daftar Transaksi &amp; Pengiriman</h2>
                      <p className="text-xs text-[#525C53] mt-0.5">
                        Seluruh pesanan dari checkout QRIS, Virtual Account, GoPay, dan COD.
                      </p>
                    </div>
                    <span className="font-mono-tabular text-xs text-[#525C53]">
                      {data.orders.length} pesanan
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F7F8F5] text-[#525C53] border-b border-[#E4E7DF]">
                        <tr>
                          <th className="px-5 py-3 font-medium">Kode &amp; Tanggal</th>
                          <th className="px-4 py-3 font-medium">Pembeli &amp; Tujuan</th>
                          <th className="px-4 py-3 font-medium">Paket</th>
                          <th className="px-4 py-3 font-medium">Metode Bayar</th>
                          <th className="px-4 py-3 font-medium text-right">Total</th>
                          <th className="px-4 py-3 font-medium">Pembayaran</th>
                          <th className="px-5 py-3 font-medium">Pengiriman</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E7DF]">
                        {data.orders.map((ord) => (
                          <tr key={ord.orderCode} className="hover:bg-[#F7F8F5]/70 align-top">
                            <td className="px-5 py-3.5 whitespace-nowrap">
                              <div className="font-mono-tabular font-semibold text-[#141A15]">
                                {ord.orderCode}
                              </div>
                              <div className="font-mono-tabular text-[#525C53] mt-0.5">
                                {formatShortTime(ord.createdAt)}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-medium text-[#141A15]">{ord.customerName}</div>
                              <div className="text-[#525C53] mt-0.5">
                                {ord.city} · +{ord.customerPhone}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-[#141A15]">
                              {ord.packageName} × {ord.quantity}
                            </td>
                            <td className="px-4 py-3.5 text-[#525C53]">
                              <div>{ord.paymentLabel}</div>
                              <div className="font-mono-tabular text-[11px]">{ord.paymentCode}</div>
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono-tabular font-semibold text-[#141A15] whitespace-nowrap">
                              {formatRupiah(ord.totalAmount)}
                            </td>
                            <td className="px-4 py-3.5">
                              <select
                                aria-label={`Status pembayaran ${ord.orderCode}`}
                                value={ord.paymentStatus}
                                disabled={busyAction === `ord-${ord.orderCode}`}
                                onChange={(e) =>
                                  void handleOrderUpdate(ord.orderCode, {
                                    paymentStatus: e.target.value as OrderRecord['paymentStatus'],
                                  })
                                }
                                className={`px-2 py-1 text-xs font-semibold bg-white border border-[#D4D9CD] rounded ${
                                  ord.paymentStatus === 'lunas'
                                    ? 'text-[#1B6B3A]'
                                    : ord.paymentStatus === 'cod_diproses'
                                      ? 'text-[#0F766E]'
                                      : 'text-[#B45309]'
                                }`}
                              >
                                <option value="menunggu">Menunggu</option>
                                <option value="lunas">Lunas</option>
                                <option value="cod_diproses">COD Diproses</option>
                              </select>
                            </td>
                            <td className="px-5 py-3.5">
                              <select
                                aria-label={`Status pengiriman ${ord.orderCode}`}
                                value={ord.fulfillmentStatus}
                                disabled={busyAction === `ord-${ord.orderCode}`}
                                onChange={(e) =>
                                  void handleOrderUpdate(ord.orderCode, {
                                    fulfillmentStatus: e.target.value as OrderRecord['fulfillmentStatus'],
                                  })
                                }
                                className="px-2 py-1 text-xs font-medium bg-white border border-[#D4D9CD] rounded text-[#141A15]"
                              >
                                <option value="menunggu_bayar">Menunggu Bayar</option>
                                <option value="dikemas">Dikemas</option>
                                <option value="dikirim">Dikirim</option>
                                <option value="selesai">Selesai</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
