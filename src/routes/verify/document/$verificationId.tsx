import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, ShieldX } from "lucide-react";

export const Route = createFileRoute("/verify/document/$verificationId")({
  component: DocumentVerificationPage,
});

type Verification = {
  verification_id: string;
  document_type: string;
  organization_id: string;
  document_hash: string;
  row_count: number;
  range_start: string | null;
  range_end: string | null;
  created_at: string;
};

function DocumentVerificationPage() {
  const { verificationId } = Route.useParams();
  const [record, setRecord] = useState<Verification | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error: rpcError } = await supabase.rpc("verify_document", {
        _verification_id: verificationId,
      });

      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      const first = data?.[0] ?? null;
      if (!first) {
        setError("Verification record not found.");
        return;
      }

      setRecord(first);
    })();

    return () => {
      cancelled = true;
    };
  }, [verificationId]);

  const verified = !!record && !error;

  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <div className="flex items-center gap-3">
          {verified ? (
            <ShieldCheck className="size-8 text-emerald-400" />
          ) : (
            <ShieldX className="size-8 text-red-400" />
          )}
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Cymatic Resonance
            </p>
            <h1 className="text-2xl font-semibold">
              {verified ? "Document authenticity record" : "Document verification failed"}
            </h1>
          </div>
        </div>

        {record ? (
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Document type</dt>
              <dd className="font-medium">{record.document_type}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Records</dt>
              <dd className="font-medium">{record.row_count}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Range</dt>
              <dd className="font-medium">
                {record.range_start || "—"} {record.range_end ? "→ " + record.range_end : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Registered</dt>
              <dd className="font-medium">{new Date(record.created_at).toLocaleString()}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Document fingerprint</dt>
              <dd className="mt-1 break-all rounded-lg bg-black/20 p-3 font-mono text-xs">
                {record.document_hash}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            {error || "Checking the verification record..."}
          </p>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          This record confirms that Cymatic Resonance registered the export fingerprint.
          It does not expose the underlying attendance records.
        </p>

        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <Link to="/explore" className="inline-flex items-center rounded-lg bg-accent px-4 py-2 font-medium text-white">
            Explore Resonance
          </Link>
          <Link to="/" className="inline-flex items-center rounded-lg border border-white/10 px-4 py-2 underline-offset-4 hover:underline">
            Return to Cymatic Resonance
          </Link>
        </div>
      </div>
    </main>
  );
}
