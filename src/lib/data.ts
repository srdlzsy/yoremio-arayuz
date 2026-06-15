export type Category = {
  id: number;
  name: string;
  description: string;
  tone: string;
};

export type Product = {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  unit: string;
  categoryId: number;
  city: string;
  district: string;
  image: string;
  harvest: string;
  rating: number;
  ratings: number;
  comments: number;
  favorites: number;
  seller: {
    id: string;
    storeName: string;
    verified: boolean;
    trustScore: number;
    products: number;
  };
  tags: string[];
};

export const categories: Category[] = [
  {
    id: 1,
    name: "Sebze",
    description: "Mevsimlik tarla ürünleri",
    tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  {
    id: 2,
    name: "Meyve",
    description: "Bahçe ve yayla meyveleri",
    tone: "bg-rose-50 text-rose-800 border-rose-200",
  },
  {
    id: 3,
    name: "Süt Ürünleri",
    description: "Peynir, tereyağı ve yoğurt",
    tone: "bg-sky-50 text-sky-800 border-sky-200",
  },
  {
    id: 4,
    name: "Bakliyat",
    description: "Kuru gıda ve tahıllar",
    tone: "bg-violet-50 text-violet-800 border-violet-200",
  },
  {
    id: 5,
    name: "Kahvaltılık",
    description: "Bal, reçel, yumurta",
    tone: "bg-amber-50 text-amber-900 border-amber-200",
  },
];

export const products: Product[] = [
  {
    id: 10,
    slug: "yayla-bali",
    name: "Posof Yayla Balı",
    description:
      "Yüksek rakımlı yaylalardan toplanan, çiçek aroması belirgin süzme bal.",
    price: 420,
    stock: 12,
    unit: "850 g",
    categoryId: 5,
    city: "Ardahan",
    district: "Posof",
    image: "/products/photo-yayla-bali.jpg",
    harvest: "2026 bahar",
    rating: 4.8,
    ratings: 21,
    comments: 12,
    favorites: 30,
    seller: {
      id: "seller-mehmet",
      storeName: "Posof Organik",
      verified: true,
      trustScore: 88,
      products: 4,
    },
    tags: ["Doğrulanmış", "Yüksek puan", "Stokta"],
  },
  {
    id: 11,
    slug: "koy-yumurtasi",
    name: "Serbest Gezen Köy Yumurtası",
    description:
      "Günlük toplanan, karışık boy doğal köy yumurtası. Paket içeriği 30 adet.",
    price: 185,
    stock: 28,
    unit: "30 adet",
    categoryId: 5,
    city: "Balıkesir",
    district: "Edremit",
    image: "/products/photo-koy-yumurtasi.jpg",
    harvest: "Günlük",
    rating: 4.6,
    ratings: 44,
    comments: 18,
    favorites: 64,
    seller: {
      id: "seller-ayse",
      storeName: "Kazdağı Çiftliği",
      verified: true,
      trustScore: 92,
      products: 12,
    },
    tags: ["Hızlı yanıt", "Toplu alım"],
  },
  {
    id: 12,
    slug: "erzincan-tulum",
    name: "Erzincan Tulum Peyniri",
    description:
      "Olgunlaştırılmış tulum peyniri. Az tuzlu, yoğun aromalı ve vakumlu paket.",
    price: 310,
    stock: 8,
    unit: "1 kg",
    categoryId: 3,
    city: "Erzincan",
    district: "Kemah",
    image: "/products/photo-tulum-peyniri.jpg",
    harvest: "Olgun",
    rating: 4.9,
    ratings: 17,
    comments: 9,
    favorites: 42,
    seller: {
      id: "seller-zeynep",
      storeName: "Kemah Mandıra",
      verified: true,
      trustScore: 84,
      products: 7,
    },
    tags: ["Soğuk zincir", "Az tuzlu"],
  },
  {
    id: 13,
    slug: "organik-nohut",
    name: "Organik Koçbaşı Nohut",
    description:
      "İri taneli, yeni sezon koçbaşı nohut. Elekten geçirilmiş ve taşsız.",
    price: 145,
    stock: 34,
    unit: "2 kg",
    categoryId: 4,
    city: "Konya",
    district: "Karatay",
    image: "/products/photo-kocbasi-nohut.jpg",
    harvest: "2026",
    rating: 4.5,
    ratings: 29,
    comments: 11,
    favorites: 22,
    seller: {
      id: "seller-hasan",
      storeName: "Bozkır Hasadı",
      verified: false,
      trustScore: 73,
      products: 18,
    },
    tags: ["Yeni sezon", "Ekonomik"],
  },
  {
    id: 14,
    slug: "dalindan-elma",
    name: "Dalından Amasya Elması",
    description:
      "İnce kabuklu, sulu ve kokulu Amasya elması. Karma boy kasalar.",
    price: 95,
    stock: 0,
    unit: "5 kg",
    categoryId: 2,
    city: "Amasya",
    district: "Merkez",
    image: "/products/photo-amasya-elmasi.jpg",
    harvest: "Ön sipariş",
    rating: 4.7,
    ratings: 33,
    comments: 16,
    favorites: 51,
    seller: {
      id: "seller-emine",
      storeName: "Yeşilırmak Bahçesi",
      verified: true,
      trustScore: 81,
      products: 9,
    },
    tags: ["Ön sipariş", "Bahçe ürünü"],
  },
  {
    id: 15,
    slug: "tarla-domatesi",
    name: "Kokulu Tarla Domatesi",
    description:
      "Salçalık ve sofralık kullanıma uygun, ince kabuklu yaz domatesi.",
    price: 120,
    stock: 46,
    unit: "10 kg",
    categoryId: 1,
    city: "Bursa",
    district: "Karacabey",
    image: "/products/photo-tarla-domatesi.jpg",
    harvest: "Bu hafta",
    rating: 4.4,
    ratings: 26,
    comments: 7,
    favorites: 19,
    seller: {
      id: "seller-murat",
      storeName: "Karacabey Tarlası",
      verified: false,
      trustScore: 69,
      products: 6,
    },
    tags: ["Hasat günü", "Kasa"],
  },
];

export const buyerDemands = [
  {
    id: 1,
    product: "Posof Yayla Balı",
    amount: "3 kavanoz",
    status: "ACIK",
    offer: "395,00 TL",
    date: "2026-06-15T10:20:30Z",
  },
  {
    id: 2,
    product: "Erzincan Tulum Peyniri",
    amount: "2 kg",
    status: "ANLASILDI",
    offer: "300,00 TL",
    date: "2026-06-13T13:10:00Z",
  },
];

export const sellerRequests = [
  {
    id: 5,
    product: "Serbest Gezen Köy Yumurtası",
    buyer: "elif@demo.yoremio.local",
    amount: "5 koli",
    status: "ACIK",
    note: "Hafta sonu teslim alabilirim.",
  },
  {
    id: 6,
    product: "Kokulu Tarla Domatesi",
    buyer: "can@demo.yoremio.local",
    amount: "30 kg",
    status: "ACIK",
    note: "Salçalık ürün için fiyat rica ederim.",
  },
];

export const conversations = [
  {
    userId: "seller-mehmet",
    name: "Posof Organik",
    lastMessage: "3 kavanoz için indirim uygulayabilirim.",
    unread: 2,
    time: "2026-06-15T10:20:30Z",
  },
  {
    userId: "buyer-elif",
    name: "elif@demo.yoremio.local",
    lastMessage: "Ürünler yarın kargoya verilir mi?",
    unread: 0,
    time: "2026-06-15T09:12:00Z",
  },
];
