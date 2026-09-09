import "./styles.css";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { supabase } from "@/integrations/supabase/client";
import { MapProvider } from "./context/map-context";
import { ErrorBoundary } from "./components/error-boundary";
import { pingSupabase } from "./lib/supabase-check";

// Pre-warm Supabase connection during idle periods to speed up initial auth check
// Global error handler to catch initialization failures
window.addEventListener("error", (event) => {
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `<div style="padding: 20px; color: red; border: 2px solid red; font-family: monospace;">
      <h1>CRITICAL ERROR</h1>
      <p>${event.message}</p>
      <pre>${event.error?.stack || "No stack trace"}</pre>
    </div>`;
  }
});
interface WindowWithIdle {
  requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
}

if (typeof window !== "undefined") {
  const prewarm = async () => {
    try {
      // Ping for diagnostic
      const status = await pingSupabase();
      console.log("Supabase connection status:", status);

      // Just accessing a property on the proxy triggers the client initialization
      // and calling getSession starts the network request early.
      supabase.auth.getSession().catch((e) => {
        console.error("Auth pre-warm error:", e);
      });
    } catch (err) {
      console.warn("Pre-warm skipped or failed:", err);
    }
  };

  if ("requestIdleCallback" in window) {
    (window as unknown as WindowWithIdle).requestIdleCallback(prewarm, { timeout: 2000 });
  } else {
    setTimeout(prewarm, 100);
  }
}

const router = getRouter();

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  console.log("[Cymatic Client] Root element found, mounting React...");
  root.render(
    <ErrorBoundary>
      <MapProvider>
        <RouterProvider router={router} />
      </MapProvider>
    </ErrorBoundary>,
  );
  console.log("[Cymatic Client] React render call completed.");
} else {
  console.error("[Cymatic Client] #root element not found!");
}
