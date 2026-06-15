# Yöremio Arayüz

Yöremio frontend arayüzü; Next.js, TypeScript, Tailwind CSS ve shadcn/ui bileşen düzeniyle hazırlanmıştır.

## Başlangıç

Geliştirme sunucusu:

```bash
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini açın.

Backend varsayılan adresi `.env.example` içinde:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:5089
```

## İçerik

- Public ürün keşfi, kategori/arama/stok/sıralama filtreleri.
- Ürün detayında fiyat, stok, satıcı güven skoru, favori, talep ve chat aksiyonları.
- Alıcı paneli, satıcı paneli ve SignalR chat arayüz iskeleti.
- API envelope, auth header, media URL ve multipart ürün formu için `src/lib/api.ts`.
- SEO metadata, Open Graph, robots, sitemap ve Product/ItemList JSON-LD.

## Komutlar

```bash
npm run dev
npm run build
npm run lint
```

Logo ve ürün görselleri `public/` altında yerel asset olarak durur. Backend gerçek medya URL'leri relative döndüğünde `mediaUrl()` API base URL ile birleştirir.
