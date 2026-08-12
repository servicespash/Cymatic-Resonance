import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CymaticWave } from "@/components/cymatic-wave";
import { Radio, Plus, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

type Status = "loading" | "linked" | "unlinked";

export function RequireWorkspace({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("org_id")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error("RequireWorkspace: error fetching profile", error);
          toast.error("Failed to load workspace info");
          setStatus("unlinked"); // Fallback to unlinked on error
        } else {
          setStatus(data?.org_id ? "linked" : "unlinked");
        }
      } catch (err) {
        console.error("RequireWorkspace: unexpected error", err);
        setStatus("unlinked");
      }
    })();
  }, [user, tick]);

  if (status === "loading") {
    return (
      <div className="grid place-items-center py-24">
        <CymaticWave className="h-10" bars={6} />
      </div>
    );
  }
  if (status === "unlinked") return <WorkspaceGate onLinked={() => setTick((t) => t + 1)} />;
  return <>{children}</>;
}

function WorkspaceGate({ onLinked }: { onLinked: () => void }) {
  const [mode, setMode] = useState<"join" | "create">("join");
  const [code, setCode] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("generic");
  const [category, setCategory] = useState("staff");
  const [busy, setBusy] = useState(false);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("join_org_with_code", {
      _code: code.trim().toUpperCase(),
      _category: category,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Resonance linked");
    onLinked();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("create_org_as_admin", {
      _name: orgName.trim(),
      _org_type: orgType,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Workspace created");
    onLinked();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto max-w-lg"
    >
      <div className="glass-strong relative overflow-hidden rounded-3xl p-8 resonance-glow">
        <div className="absolute inset-0 -z-10 bg-frequency/20 blur-3xl" />
        <div className="grid size-14 place-items-center rounded-2xl bg-frequency/20 ring-1 ring-white/10">
          <Radio className="size-6 text-accent" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold tracking-tight">No workspace linked</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Join an existing resonance field with a CYM code, or spin up a new workspace as
          administrator.
        </p>

        <div className="mt-6 inline-flex rounded-xl border border-white/10 bg-white/5 p-1 text-xs">
          {(["join", "create"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 font-mono uppercase tracking-widest transition ${
                mode === m ? "bg-frequency text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "join" ? "Join" : "Create"}
            </button>
          ))}
        </div>

        {mode === "join" ? (
          <form onSubmit={join} className="mt-5 space-y-3">
            <Field label="Access code" icon={<KeyRound className="size-3.5" />}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CYM-XXXX"
                className="w-full bg-transparent font-mono text-lg tracking-[0.3em] outline-none placeholder:text-muted-foreground/40"
              />
            </Field>
            <Field label="Category">
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </Field>
            <button
              disabled={busy}
              className="w-full rounded-xl bg-frequency px-4 py-3 text-sm font-semibold text-primary-foreground resonance-glow disabled:opacity-50"
            >
              {busy ? "Linking…" : "Join workspace"}
            </button>
          </form>
        ) : (
          <form onSubmit={create} className="mt-5 space-y-3">
            <Field label="Workspace name" icon={<Plus className="size-3.5" />}>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Acme Field Ops"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
              />
            </Field>
            <Field label="Type">
              <input
                value={orgType}
                onChange={(e) => setOrgType(e.target.value)}
                placeholder="generic"
                className="w-full bg-transparent text-sm outline-none"
              />
            </Field>
            <button
              disabled={busy}
              className="w-full rounded-xl bg-frequency px-4 py-3 text-sm font-semibold text-primary-foreground resonance-glow disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create as admin"}
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 focus-within:border-primary/40">
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </label>
  );
}
