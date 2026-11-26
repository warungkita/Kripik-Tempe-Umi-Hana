import { useState } from 'react';
import { Leaf, Menu, ShoppingCart, X } from 'lucide-react';

interface NavbarProps {
  activeView: 'storefront' | 'tracking' | 'dashboard';
  onSwitchView: (view: 'storefront' | 'tracking' | 'dashboard') => void;
  onQuickOrder: () => void;
}

export function Navbar({ activeView, onSwitchView, onQuickOrder }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleAnchor = (sectionId: string) => {
    setMobileOpen(false);
    if (activeView !== 'storefront') {
      onSwitchView('storefront');
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FFFDF5]/95 backdrop-blur-md border-b border-[#EAE2C6]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 lg:h-16 flex items-center justify-between gap-4 lg:gap-8">
        {/* Zone 1: Single clean brand wordmark with botanical leaf mark */}
        <button
          type="button"
          onClick={() => {
            setMobileOpen(false);
            onSwitchView('storefront');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight text-[#146523] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#157A28] cursor-pointer"
        >
          <Leaf className="w-5 h-5 text-[#1E8E30] fill-[#1E8E30]/15 shrink-0" aria-hidden="true" />
          Umi Hana
        </button>

        {/* Zone 2: 5 concise single-line text links */}
        <nav aria-label="Navigasi Utama" className="hidden lg:flex items-center gap-6 xl:gap-7 text-sm font-semibold text-[#3C4B38]">
          <button
            type="button"
            onClick={() => handleAnchor('keunggulan')}
            className="hover:text-[#157A28] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Keunggulan
          </button>
          <button
            type="button"
            onClick={() => handleAnchor('paket')}
            className="hover:text-[#157A28] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Paket &amp; Harga
          </button>
          <button
            type="button"
            onClick={() => handleAnchor('testimoni')}
            className="hover:text-[#157A28] transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Testimoni
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onSwitchView('tracking');
            }}
            className={`transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'tracking'
                ? 'text-[#157A28] underline underline-offset-4'
                : 'hover:text-[#157A28]'
            }`}
          >
            Lacak Pesanan
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onSwitchView('dashboard');
            }}
            className={`transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
              activeView === 'dashboard'
                ? 'text-[#157A28] underline underline-offset-4'
                : 'hover:text-[#157A28]'
            }`}
          >
            Dashboard CRM
          </button>
        </nav>

        {/* Zone 3: 1 primary CTA action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              onQuickOrder();
            }}
            className="hidden sm:inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-[#177A28] hover:bg-[#11601E] rounded-full shadow-sm transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#157A28] cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            Pesan Sekarang
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            aria-expanded={mobileOpen}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-xl border border-[#EAE2C6] bg-white text-[#1C2A1A] hover:bg-[#F7F3E3] transition-colors cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden fixed inset-x-0 top-14 bottom-0 z-40 bg-[#141A15]/30 backdrop-blur-[1px]"
          />
          <div className="lg:hidden absolute left-0 right-0 top-full z-50 border-t border-b border-[#EAE2C6] bg-[#FFFDF5] shadow-[0_18px_36px_rgba(20,26,21,0.16)] px-4 py-4 space-y-1">
            <button
              type="button"
              onClick={() => handleAnchor('keunggulan')}
              className="w-full text-left px-3 py-3 text-sm font-semibold text-[#1C2A1A] hover:bg-[#F4EED9] rounded-xl cursor-pointer"
            >
              Keunggulan &amp; Detail Produk
            </button>
            <button
              type="button"
              onClick={() => handleAnchor('paket')}
              className="w-full text-left px-3 py-3 text-sm font-semibold text-[#1C2A1A] hover:bg-[#F4EED9] rounded-xl cursor-pointer"
            >
              Paket &amp; Harga
            </button>
            <button
              type="button"
              onClick={() => handleAnchor('testimoni')}
              className="w-full text-left px-3 py-3 text-sm font-semibold text-[#1C2A1A] hover:bg-[#F4EED9] rounded-xl cursor-pointer"
            >
              Testimoni Pelanggan
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onSwitchView('tracking');
              }}
              className={`w-full text-left px-3 py-3 text-sm font-semibold rounded-xl cursor-pointer ${
                activeView === 'tracking'
                  ? 'text-[#157A28] bg-[#EBF6E8]'
                  : 'text-[#1C2A1A] hover:bg-[#F4EED9]'
              }`}
            >
              Lacak Pesanan
            </button>
            <button
              type="button"
              onClick={() => handleAnchor('konsultasi')}
              className="w-full text-left px-3 py-3 text-sm font-semibold text-[#1C2A1A] hover:bg-[#F4EED9] rounded-xl cursor-pointer"
            >
              Konsultasi Grosir &amp; Reseller
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onSwitchView('dashboard');
              }}
              className="w-full text-left px-3 py-3 text-sm font-bold text-[#157A28] hover:bg-[#EBF6E8] rounded-xl cursor-pointer"
            >
              Dashboard CRM &amp; Analitik
            </button>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onQuickOrder();
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-[#1B2E12] bg-[#FACC15] hover:bg-[#EAB308] rounded-full shadow-sm transition-colors cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                Pesan Sekarang
              </button>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
