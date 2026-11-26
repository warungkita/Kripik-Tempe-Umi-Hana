import { useEffect, useState } from 'react';
import { CheckoutModal } from './components/CheckoutModal.tsx';
import { FloatingWhatsAppButton } from './components/FloatingWhatsAppButton.tsx';
import { LandingSalesPage } from './components/LandingSalesPage.tsx';
import { MerchantDashboard } from './components/MerchantDashboard.tsx';
import { Navbar } from './components/Navbar.tsx';
import { OrderTrackingPage } from './components/OrderTrackingPage.tsx';
import { ScrollToTopRocket } from './components/ScrollToTopRocket.tsx';
import { fetchPublicSummary, trackAnalyticsEvent } from './lib/api.ts';
import type { OrderRecord, PackageId } from './types.ts';

export default function App() {
  const [activeView, setActiveView] = useState<'storefront' | 'tracking' | 'dashboard'>('storefront');
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageId>('keluarga-6');
  const [recentOrderCode, setRecentOrderCode] = useState<string | null>(null);
  const [trackingOrderCode, setTrackingOrderCode] = useState<string | null>(null);

  const [packsDelivered, setPacksDelivered] = useState(12400);
  const [activeCustomers, setActiveCustomers] = useState(1840);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === message ? null : prev));
    }, 3600);
  };

  // Track initial landing page view & fetch live public social proof counters
  useEffect(() => {
    void trackAnalyticsEvent('page_view', 'Landing & Sales Page Umi Hana');
    fetchPublicSummary()
      .then((summary) => {
        setPacksDelivered(summary.packsDelivered);
        setActiveCustomers(summary.activeCustomers);
      })
      .catch(() => {});
  }, []);

  // Track when shopper scrolls into pricing/sales offer section
  useEffect(() => {
    if (activeView !== 'storefront') return;
    const pricingEl = document.getElementById('paket');
    if (!pricingEl || typeof IntersectionObserver === 'undefined') return;
    let recorded = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!recorded && entries.some((entry) => entry.isIntersecting)) {
          recorded = true;
          void trackAnalyticsEvent('view_pricing', 'Bagian Paket & Harga');
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(pricingEl);
    return () => observer.disconnect();
  }, [activeView]);

  const handleOpenCheckout = (packageId: PackageId, sourceLabel: string) => {
    void trackAnalyticsEvent('cta_click', sourceLabel);
    setSelectedPackage(packageId);
    setCheckoutOpen(true);
  };

  const handleOpenTracking = (orderCode?: string) => {
    if (orderCode) {
      setTrackingOrderCode(orderCode);
    } else if (recentOrderCode) {
      setTrackingOrderCode(recentOrderCode);
    }
    setActiveView('tracking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOrderCompleted = (order: OrderRecord) => {
    setRecentOrderCode(order.orderCode);
    setTrackingOrderCode(order.orderCode);
    fetchPublicSummary()
      .then((summary) => {
        setPacksDelivered(summary.packsDelivered);
        setActiveCustomers(summary.activeCustomers);
      })
      .catch(() => {});
  };

  const showFloatingWa = activeView !== 'dashboard' && !checkoutOpen;

  return (
    <div className="min-h-screen bg-white text-[#141A15]">
      <Navbar
        activeView={activeView}
        onSwitchView={(view) => {
          setActiveView(view);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onQuickOrder={() => {
          if (activeView === 'dashboard') {
            setActiveView('storefront');
          }
          handleOpenCheckout('keluarga-6', 'Header Primary CTA');
        }}
      />

      {activeView === 'storefront' ? (
        <LandingSalesPage
          packsDelivered={packsDelivered}
          activeCustomers={activeCustomers}
          recentOrderCode={recentOrderCode}
          onSelectPackage={handleOpenCheckout}
          onOpenTracking={handleOpenTracking}
          onOpenDashboard={() => {
            setActiveView('dashboard');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNotify={showToast}
        />
      ) : activeView === 'tracking' ? (
        <OrderTrackingPage
          initialOrderCode={trackingOrderCode ?? recentOrderCode}
          onBackToStorefront={() => {
            setActiveView('storefront');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onQuickOrder={() => handleOpenCheckout('keluarga-6', 'Order Tracking CTA')}
        />
      ) : (
        <MerchantDashboard
          adminToken={adminToken}
          onSetAdminToken={setAdminToken}
          onBackToStorefront={() => {
            setActiveView('storefront');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onNotify={showToast}
        />
      )}

      <CheckoutModal
        isOpen={checkoutOpen}
        initialPackageId={selectedPackage}
        onClose={() => setCheckoutOpen(false)}
        onOrderCompleted={handleOrderCompleted}
        onTrackOrder={handleOpenTracking}
        onNotify={showToast}
      />

      <ScrollToTopRocket hidden={checkoutOpen} />

      <FloatingWhatsAppButton hidden={!showFloatingWa} />

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 sm:right-6 z-50 max-w-sm bg-[#141A15] text-white text-xs sm:text-sm font-medium px-4 py-3 rounded-xl shadow-lg border border-white/10 ${
            showFloatingWa ? 'bottom-24' : 'bottom-5'
          }`}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
