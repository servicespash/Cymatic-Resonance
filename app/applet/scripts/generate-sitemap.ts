import fs from "fs";

const routes = [
  { loc: "https://resonance.cymatichub.xyz/", priority: "1.0" },
  { loc: "https://resonance.cymatichub.xyz/dashboard", priority: "0.8" },
  { loc: "https://resonance.cymatichub.xyz/comms", priority: "0.7" },
  { loc: "https://resonance.cymatichub.xyz/directory", priority: "0.7" },
  { loc: "https://resonance.cymatichub.xyz/reporting", priority: "0.6" },
  { loc: "https://resonance.cymatichub.xyz/settings", priority: "0.5" },
  { loc: "https://resonance.cymatichub.xyz/about-legal", priority: "0.4" },
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(
    (r) => `  <url>
    <loc>${r.loc}</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${r.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

fs.writeFileSync("public/sitemap.xml", xml);
console.log("Sitemap generated successfully.");
