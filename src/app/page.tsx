import { products } from "@/lib/data";
import { YoremioMarketplace } from "@/components/yoremio/marketplace";

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Yöremio",
    url: "https://yoremio.com",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://yoremio.com/?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: products.slice(0, 5).map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Product",
          name: product.name,
          description: product.description,
          image: product.image,
          offers: {
            "@type": "Offer",
            price: product.price,
            priceCurrency: "TRY",
            availability:
              product.stock > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/PreOrder",
          },
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.comments,
          },
        },
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <YoremioMarketplace />
    </>
  );
}
