import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type AuthClient = {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<{
      data: { client?: { name?: string }; redirect_url?: string; redirect_to?: string; scope?: string } | null;
      error: { message: string } | null;
    }>;
    approveAuthorization: (id: string) => Promise<{
      data: { redirect_url?: string; redirect_to?: string } | null;
      error: { message: string } | null;
    }>;
    denyAuthorization: (id: string) => Promise<{
      data: { redirect_url?: string; redirect_to?: string } | null;
      error: { message: string } | null;
    }>;
  };
};

function oauth() {
  return (supabase.auth as unknown as AuthClient).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } as never });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen grid place-items-center p-8 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">Authorization unavailable</h1>
        <p className="text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an external app";

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card/80 p-8 shadow-xl backdrop-blur space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Connect {clientName} to Cymatic Resonance
          </h1>
          <p className="text-sm text-muted-foreground">
            {clientName} will be able to call this workspace's tools while you're signed in.
            Workspace policies and RLS still apply to everything it does.
          </p>
        </div>

        <ul className="text-sm space-y-2 text-muted-foreground">
          <li>• Read your profile and workspace membership</li>
          <li>• List members and attendance you already have access to</li>
          <li>• Check in and post messages on your behalf</li>
        </ul>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={busy} onClick={() => decide(false)}>
            Deny
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            {busy ? "Working…" : "Approve & connect"}
          </Button>
        </div>
      </div>
    </main>
  );
}
