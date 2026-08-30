import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { CallProvider } from "@/components/call-provider";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Skip auth check on the server since we are using localStorage which the server can't access.
    if (typeof window === "undefined") {
      return { user: null as any };
    }

    if (window.location.hash.includes("access_token=")) {
      console.log("[_authenticated/route] OAuth callback detected in URL hash. Bypassing route guard.");
      return { user: null as any };
    }

    // Use getSession for client-side routing checks to prevent network failures 
    // from triggering infinite signout loops. The token is stored locally.
    // Real validation happens via RLS on subsequent data requests.
    const { data, error } = await supabase.auth.getSession();
    console.log("[_authenticated/route] getSession result:", !!data.session);
    
    if (error || !data.session) {
      console.warn("[_authenticated/route] Redirecting to /auth", error);
      // If the session is truly invalid/missing, clear it to break infinite loops
      await supabase.auth.signOut().catch(() => {});
      throw redirect({ to: "/auth" });
    }
    
    return { user: data.session.user };
  },
  component: () => (
    <CallProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </CallProvider>
  ),
});
