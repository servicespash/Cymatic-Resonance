import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass max-w-md rounded-2xl p-10 text-center">
        <h1 className="font-display text-7xl font-bold text-gradient">404</h1>
        <p className="mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Signal lost
        </p>
        <p className="mt-2 text-sm text-muted-foreground">This frequency does not resonate.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-frequency px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Return to base
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass max-w-md rounded-2xl p-8 text-center">
        <h1 className="font-display text-xl font-semibold">Resonance interrupted</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-frequency px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Reconnect
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Cymatic Resonance — Workspace presence, comms & attendance" },
      {
        name: "description",
        content:
          "Cymatic Resonance by Isabirye Latif (cymatichub.xyz) — elite real-time attendance tracking, DMs, group calls and workspace presence for high-performance teams.",
      },
      { name: "author", content: "Isabirye Latif" },
      { name: "creator", content: "Isabirye Latif — cymatichub.xyz" },
      { name: "publisher", content: "CymaticHub" },
      {
        name: "keywords",
        content:
          "cymatic resonance, cymatichub, isabirye latif, team attendance, workspace presence, real-time comms, team DM, group video calls, remote team tracking, cym access code, attendance software, presence platform",
      },
      { name: "theme-color", content: "#030712" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
      { name: "googlebot", content: "index, follow" },
      { property: "og:site_name", content: "Cymatic Resonance" },
      { property: "og:locale", content: "en_US" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@cymatichub" },
      { name: "twitter:creator", content: "@cymatichub" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://cymatichub.xyz/#org",
              name: "CymaticHub",
              url: "https://cymatichub.xyz",
              founder: {
                "@type": "Person",
                name: "Isabirye Latif",
                url: "https://cymatichub.xyz",
              },
            },
            {
              "@type": "WebSite",
              "@id": "https://resonance.cymatichub.xyz/#website",
              url: "https://resonance.cymatichub.xyz",
              name: "Cymatic Resonance",
              publisher: { "@id": "https://cymatichub.xyz/#org" },
              inLanguage: "en",
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster theme="dark" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
