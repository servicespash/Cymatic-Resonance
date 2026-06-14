import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CymaticLogo, CymaticWave } from "@/components/cymatic-wave";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Enter workspace — Cymatic Resonance" }] }),
});

const baseSignUp = {
  full_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  position: z.string().trim().max(60).optional().or(z.literal("")),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
};
const adminSchema = z.object({
  ...baseSignUp,
  org_name: z.string().trim().min(2).max(80),
  org_type: z.string().trim().max(40),
});
const memberSchema = z.object({
  ...baseSignUp,
  access_code: z.string().trim().regex(/^CYM-[A-Z0-9]{4}$/i, "Code must look like CYM-XXXX"),
  category: z.string().trim().max(40),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/pulse" });
  }, [user, loading, navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Resonance established");
    navigate({ to: "/pulse" });
  };

  const completeProfile = async (
    userId: string,
    patch: { role?: "admin" | "member"; org_id?: string | null; category?: string | null },
  ) => {
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
      if (data) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    return supabase.from("profiles").update(patch).eq("id", userId);
  };

  const handleAdminSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = adminSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { data: auth, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/pulse`,
        data: {
          full_name: parsed.data.full_name,
          phone: parsed.data.phone,
          position: parsed.data.position,
        },
      },
    });
    if (error || !auth.user) { setBusy(false); return toast.error(error?.message ?? "Sign up failed"); }

    // Generate CYM code via RPC fallback: gen via SQL function through a single insert
    const code = "CYM-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name: parsed.data.org_name, org_type: parsed.data.org_type, access_code: code, created_by: auth.user.id })
      .select()
      .single();
    if (orgErr || !org) { setBusy(false); return toast.error(orgErr?.message ?? "Could not create workspace"); }

    await completeProfile(auth.user.id, { role: "admin", org_id: org.id });
    setBusy(false);
    toast.success(`Workspace created · ${org.access_code}`, { description: "Share this code with members." });
    navigate({ to: "/dashboard" });
  };

  const handleMemberSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = memberSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const code = parsed.data.access_code.toUpperCase();

    const { data: auth, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/pulse`,
        data: {
          full_name: parsed.data.full_name,
          phone: parsed.data.phone,
          position: parsed.data.position,
        },
      },
    });
    if (error || !auth.user) { setBusy(false); return toast.error(error?.message ?? "Sign up failed"); }

    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, access_code")
      .eq("access_code", code)
      .maybeSingle();
    if (!org) { setBusy(false); return toast.error("Invalid CYM access code"); }

    await completeProfile(auth.user.id, { role: "member", org_id: org.id, category: parsed.data.category });
    setBusy(false);
    toast.success(`Joined ${org.name}`);
    navigate({ to: "/pulse" });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <CymaticWave className="h-10" bars={6} />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen px-4 py-10">
      <Link to="/" className="absolute left-6 top-6"><CymaticLogo /></Link>

      <div className="mx-auto mt-12 w-full max-w-md animate-fade-up">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Enter the <span className="text-gradient">resonance</span>
          </h1>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            workspace · secured · signal-locked
          </p>
        </div>

        <div className="glass-strong mt-8 rounded-2xl p-6 resonance-glow">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-white/5">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="admin">Admin</TabsTrigger>
              <TabsTrigger value="member">Join</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <Field id="si-email" label="Email" name="email" type="email" required />
                <Field id="si-pw" label="Password" name="password" type="password" required />
                <SubmitBtn busy={busy}>Sign in</SubmitBtn>
              </form>
            </TabsContent>

            <TabsContent value="admin">
              <form onSubmit={handleAdminSignUp} className="space-y-3">
                <Field id="ad-org" label="Organization name" name="org_name" required maxLength={80} placeholder="Acme HQ" />
                <Field id="ad-type" label="Workspace type" name="org_type" defaultValue="generic" placeholder="school, factory, agency…" />
                <div className="h-px bg-white/5 my-2" />
                <Field id="ad-name" label="Your name" name="full_name" required maxLength={80} />
                <div className="grid grid-cols-2 gap-3">
                  <Field id="ad-phone" label="Phone" name="phone" type="tel" maxLength={30} />
                  <Field id="ad-pos" label="Position" name="position" maxLength={60} placeholder="Director" />
                </div>
                <Field id="ad-email" label="Email" name="email" type="email" required />
                <Field id="ad-pw" label="Password" name="password" type="password" required minLength={6} />
                <SubmitBtn busy={busy}>Create workspace</SubmitBtn>
              </form>
            </TabsContent>

            <TabsContent value="member">
              <form onSubmit={handleMemberSignUp} className="space-y-3">
                <Field id="mb-code" label="CYM access code" name="access_code" required placeholder="CYM-XXXX" className="font-mono uppercase tracking-widest" />
                <Field id="mb-cat" label="Category / team" name="category" placeholder="Engineering, Grade 4, Night shift…" />
                <div className="h-px bg-white/5 my-2" />
                <Field id="mb-name" label="Full name" name="full_name" required maxLength={80} />
                <div className="grid grid-cols-2 gap-3">
                  <Field id="mb-phone" label="Phone" name="phone" type="tel" maxLength={30} />
                  <Field id="mb-pos" label="Position" name="position" maxLength={60} placeholder="Teacher" />
                </div>
                <Field id="mb-email" label="Email" name="email" type="email" required />
                <Field id="mb-pw" label="Password" name="password" type="password" required minLength={6} />
                <SubmitBtn busy={busy}>Join workspace</SubmitBtn>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}

function Field({ label, id, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</Label>
      <Input id={id} className={`bg-white/5 border-white/10 focus-visible:ring-primary/60 ${className ?? ""}`} {...props} />
    </div>
  );
}

function SubmitBtn({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={busy} className="w-full bg-frequency text-primary-foreground resonance-glow hover:brightness-110">
      {busy ? <CymaticWave className="h-4" bars={4} /> : children}
    </Button>
  );
}
