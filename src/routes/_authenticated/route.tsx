import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { CallProvider } from "@/components/call-provider";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async (): Promise<{ user: User | null }> => {
    // Skip auth check on the server since we are using localStorage which the server can't access.
    if (typeof window === "undefined") {
      return { user: null };
    }

    if (window.location.hash.includes("access_token=")) {
      console.log(
        "[_authenticated/route] OAuth callback detected in URL hash. Bypassing route guard.",
      );
      return { user: null };
    }

    let session = (await supabase.auth.getSession()).data.session;
    if (!session) {
      // Small grace period for in-flight token persist
      await new Promise((r) => setTimeout(r, 150));
      session = (await supabase.auth.getSession()).data.session;
    }

    console.log("[_authenticated/route] getSession check:", {
      hasSession: !!session,
      user: session?.user?.email,
    });

    if (!session) {
      console.warn("[_authenticated/route] No active session. Redirecting to /auth");
      throw redirect({ to: "/auth" });
    }

    return { user: session.user };
  },
  component: () => (
    <CallProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </CallProvider>
  ),
});
