import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";
import { supabase } from "@/integrations/supabase/client";
import { ErrorBoundary } from "./components/error-boundary";

// Pre-warm Supabase connection during idle periods to speed up initial auth check
interface WindowWithIdle {
  requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
}

if (typeof window !== "undefined") {
  const prewarm = () => {
    // Just accessing a property on the proxy triggers the client initialization
    // and calling getSession starts the network request early.
    supabase.auth.getSession().catch((e) => {
      console.error("Auth pre-warm error:", e);
    });
  };

  if ("requestIdleCallback" in window) {
    (window as unknown as WindowWithIdle).requestIdleCallback(prewarm, { timeout: 2000 });
  } else {
    setTimeout(prewarm, 100);
  }
}

hydrateRoot(
  document,
  <ErrorBoundary>
    <StartClient />
  </ErrorBoundary>
);
