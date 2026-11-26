import type { PaymentMethodId, ProductPackage, Testimonial } from '../types.ts';

export const BRAND_INFO = {
  name: 'Umi Hana',
  productTitle: 'Kripik Tempe Rasa Original',
  producer: 'PT Hana Food Indonesia',
  origin: 'Indonesia',
  netWeightPerPack: 60,
  whatsappDisplay: '0898 5292 010',
  whatsappNormalized: '628985292010',
  barcode: '9 772975 000123',
  packagingImage: '/assets/aistudio/Kemasan_Keripik_Tempe_Umi_Hana__1_-removebg-preview_d7b11755.png',
  bowlImage: '/assets/aistudio/tempe_d7532030.png',
  familyImage: '/assets/aistudio/Keluarga_Ceria_Menikmati_Keripik_Tempeh_83b8c12d.png',
  heroModelImage: '/assets/aistudio/Promosi_Kerupuk_Tempe_Ceria_d16c0b3c.png',
};

export const INGREDIENTS_LIST = [
  'Tempe kedelai pilihan',
  'Tepung beras halus',
  'Bumbu rempah alami',
  'Minyak nabati bersih',
  'Garam secukupnya',
];

export const NUTRITION_FACTS = [
  { label: 'Energi Total', value: '310 kkal', note: 'Sumber tenaga padat untuk aktivitas harian' },
  { label: 'Protein Nabati', value: '18 g', note: 'Tinggi protein dari fermentasi kedelai utuh' },
  { label: 'Lemak Total', value: '24 g', note: 'Digoreng dengan minyak nabati terkontrol' },
  { label: 'Karbohidrat', value: '54 g', note: 'Balutan tipis tepung beras renyah' },
  { label: 'Natrium', value: '260 mg', note: 'Gurih seimbang, ramah untuk keluarga' },
];

export const PRODUCT_PACKAGES: ProductPackage[] = [
  {
    id: 'coba-3',
    name: 'Paket Coba Keluarga',
    audience: 'Untuk mencicipi kerenyahan pertama kali',
    packCount: 3,
    weightGrams: 180,
    price: 45000,
    compareAtPrice: 51000,
    pricePerPack: 15000,
    freeShipping: false,
    recommended: false,
    summary: '3 pouch Umi Hana Kripik Tempe Rasa Original (3 × 60 g), dikemas kardus pelindung tebal.',
    highlights: [
      '3 standing pouch × 60 g (total 180 g)',
      'Produksi batch terbaru (masa simpan 4 bulan)',
      'Kemasan standing pouch zipper tahan lembap',
      'Dukungan QRIS, Virtual Account, E-Wallet, & COD',
    ],
  },
  {
    id: 'keluarga-6',
    name: 'Paket Stok Rumah',
    audience: 'Paling banyak dipilih pelanggan setia',
    packCount: 6,
    weightGrams: 360,
    price: 84000,
    compareAtPrice: 102000,
    pricePerPack: 14000,
    freeShipping: true,
    recommended: true,
    summary: '6 pouch Umi Hana Kripik Tempe Rasa Original (6 × 60 g) dengan gratis ongkir pengiriman reguler.',
    highlights: [
      '6 standing pouch × 60 g (hemat Rp 18.000)',
      'Gratis ongkir reguler seluruh Pulau Jawa',
      'Garansi ganti baru jika kemasan rusak saat tiba',
      'Prioritas pengiriman di hari yang sama',
    ],
  },
  {
    id: 'reseller-15',
    name: 'Paket Kantor & Reseller',
    audience: 'Untuk hampers, stok pantry, atau jual kembali',
    packCount: 15,
    weightGrams: 900,
    price: 195000,
    compareAtPrice: 255000,
    pricePerPack: 13000,
    freeShipping: true,
    recommended: false,
    summary: '15 pouch Umi Hana Kripik Tempe (900 g) dengan harga grosir langsung dari PT Hana Food Indonesia.',
    highlights: [
      '15 standing pouch × 60 g (Rp 13.000 / pouch)',
      'Gratis ongkir + pengemasan dus karton berlapis',
      'Akses konsultasi repeat order via WhatsApp bisnis',
      'Faktur resmi PT Hana Food Indonesia tersedia',
    ],
  },
];

export const PAYMENT_METHODS: Array<{
  id: PaymentMethodId;
  label: string;
  category: 'Instan' | 'Transfer Bank' | 'Bayar di Tempat';
  description: string;
}> = [
  {
    id: 'qris',
    label: 'QRIS Instan',
    category: 'Instan',
    description: 'Scan lewat BCA Mobile, Livin, GoPay, OVO, DANA, atau ShopeePay.',
  },
  {
    id: 'va_bca',
    label: 'BCA Virtual Account',
    category: 'Transfer Bank',
    description: 'Verifikasi otomatis tanpa perlu kirim bukti transfer manual.',
  },
  {
    id: 'va_mandiri',
    label: 'Mandiri Virtual Account',
    category: 'Transfer Bank',
    description: 'Bayar cepat melalui Livin by Mandiri atau ATM Mandiri.',
  },
  {
    id: 'va_bni',
    label: 'BNI Virtual Account',
    category: 'Transfer Bank',
    description: 'Mendukung BNI Mobile Banking dan transfer antarbank.',
  },
  {
    id: 'ewallet_gopay',
    label: 'GoPay / E-Wallet',
    category: 'Instan',
    description: 'Konfirmasi instan menggunakan nomor ponsel terdaftar.',
  },
  {
    id: 'cod',
    label: 'Bayar di Tempat (COD)',
    category: 'Bayar di Tempat',
    description: 'Bayar tunai langsung ke kurir saat paket tiba di rumah Anda.',
  },
];

export const VERIFIED_TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    name: 'Ratna Wijaya',
    role: 'Ibu Rumah Tangga & Pengajar',
    city: 'Bandung',
    segment: 'Keluarga',
    packageBought: 'Paket Stok Rumah (6 Bungkus)',
    quote:
      'Sebelumnya anak-anak selalu pilih camilan ringan kemasan yang terlalu asin. Setelah coba Umi Hana, mereka langsung suka karena irisannya tipis, bumbunya terasa alami, dan tidak berminyak di jari.',
    outcome: 'Sudah repeat order 4 kali dalam 3 bulan terakhir.',
    verifiedDate: '12 November 2026',
  },
  {
    id: 't2',
    name: 'Hendro Santoso',
    role: 'General Affairs Lead, PT Sinar Logistik',
    city: 'Jakarta Selatan',
    segment: 'Kantor & Hampers',
    packageBought: 'Paket Kantor & Reseller (15 Bungkus)',
    quote:
      'Kami butuh camilan rapat yang rapi kemasannya dan punya informasi nilai gizi jelas. Pesan sore lewat QRIS, besok siang langsung tiba dengan dus kokoh dan nol bungkus remuk.',
    outcome: 'Menjadi pasokan rutin pantry mingguan untuk 40 karyawan.',
    verifiedDate: '16 November 2026',
  },
  {
    id: 't3',
    name: 'Nadia Kusuma',
    role: 'Pemilik Kedai Kopi Ruang Teduh',
    city: 'Yogyakarta',
    segment: 'Reseller',
    packageBought: 'Paket Kantor & Reseller (15 Bungkus)',
    quote:
      'Awalnya cuma ambil 15 bungkus untuk tes jual di meja kasir kopi. Ternyata 4 hari langsung habis karena pelanggan suka tekstur renyahnya yang pas menemani kopi susu.',
    outcome: 'Penjualan tambahan Rp 1,8 juta per bulan dengan margin stabil.',
    verifiedDate: '19 November 2026',
  },
  {
    id: 't4',
    name: 'Bambang Prasetyo',
    role: 'Karyawan Swasta',
    city: 'Surabaya',
    segment: 'Keluarga',
    packageBought: 'Paket Stok Rumah (6 Bungkus)',
    quote:
      'Yang paling saya apresiasi adalah kerenyahannya tahan lama meski sudah dibuka dan disimpan ulang di toples rapat. Pengingat status pengiriman lewat WhatsApp juga sangat membantu.',
    outcome: 'Membeli ulang untuk oleh-oleh keluarga di Malang.',
    verifiedDate: '21 November 2026',
  },
];

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getPackageById(id: string): ProductPackage {
  return PRODUCT_PACKAGES.find((pkg) => pkg.id === id) ?? PRODUCT_PACKAGES[1];
}
