import React, { useEffect } from "react";

export const SchemaProvider = () => {
  useEffect(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Cymatic Resonance",
      applicationCategory: "UtilitiesApplication",
      description:
        "Advanced registry, attendance tracking, monitoring, and real-time communication platform for resonance management.",
      softwareVersion: "1.0.0",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.innerHTML = JSON.stringify(schema);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  return null;
};
