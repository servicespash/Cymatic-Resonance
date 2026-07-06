import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  access_code: z
    .string()
    .trim()
    .regex(/^CYM-[A-Z0-9]{4}$/i, "Code must look like CYM-XXXX"),
  category: z.string().trim().max(40),
});
const inviteSignUpSchema = z.object({ ...baseSignUp });

function getQuery() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"normal" | "reset" | "invite">("normal");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invitePreview, setInvitePreview] = useState<{
    org_name: string;
    email: string;
    accepted: boolean;
  } | null>(null);

  // Detect mode from URL
  useEffect(() => {
    const q = getQuery();
    if (q.get("reset") === "1") setMode("reset");
    const token = q.get("invite");
    if (token) {
      setInviteToken(token);
      setMode("invite");
      // Supabase RPC disabled - would require Supabase connection
    }
  }, []);

  // If signed in + invite token, redeem
  useEffect(() => {
    if (loading) return;
    if (user && mode === "normal") {
      navigate({ to: "/pulse" });
    }
  }, [user, loading, mode, navigate]);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    toast.error("Authentication disabled - Supabase not configured");
    setBusy(false);
  };

  const handleGoogle = async () => {
    setBusy(true);
    toast.error("OAuth disabled - Supabase not configured");
    setBusy(false);
  };

  const handleResetSend = async (email: string) => {
    toast.error("Password reset disabled - Supabase not configured");
  };

  const handleResetSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast.error("Password reset disabled - Supabase not configured");
  };

  const ensureSession = async (email: string, password: string) => {
    return false;
  };

  const handleAdminSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = adminSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    toast.error("Signup disabled - Supabase not configured");
    setBusy(false);
  };

  const handleMemberSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = memberSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    toast.error("Signup disabled - Supabase not configured");
    setBusy(false);
  };

  const handleInviteSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inviteToken) return;
    const fd = new FormData(e.currentTarget);
    const parsed = inviteSignUpSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    toast.error("Signup disabled - Supabase not configured");
    setBusy(false);
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
      <Link to="/" className="absolute left-6 top-6">
        <CymaticLogo />
      </Link>

      <div className="mx-auto mt-12 w-full max-w-md animate-fade-up">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {mode === "reset" ? (
              <>
                Set <span className="text-gradient">new password</span>
              </>
            ) : mode === "invite" ? (
              <>
                Join the <span className="text-gradient">resonance</span>
              </>
            ) : (
              <>
                Enter the <span className="text-gradient">resonance</span>
              </>
            )}
          </h1>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            {mode === "invite" && invitePreview
              ? `invited to ${invitePreview.org_name}`
              : "workspace · secured · signal-locked"}
          </p>
        </div>

        <div className="glass-strong mt-8 rounded-2xl p-6 resonance-glow">
          {mode === "reset" ? (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <Field
                id="rs-pw"
                label="New password"
                name="password"
                type="password"
                required
                minLength={6}
              />
              <SubmitBtn busy={busy}>Update password</SubmitBtn>
            </form>
          ) : mode === "invite" ? (
            <>
              {invitePreview?.accepted ? (
                <p className="text-center text-sm text-muted-foreground">
                  This invite has already been used.
                </p>
              ) : (
                <Tabs defaultValue="signup">
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-white/5">
                    <TabsTrigger value="signup">Create account</TabsTrigger>
                    <TabsTrigger value="signin">Sign in</TabsTrigger>
                  </TabsList>
                  <TabsContent value="signup">
                    <GoogleBtn busy={busy} onClick={handleGoogle} />
                    <Divider />
                    <form onSubmit={handleInviteSignUp} className="space-y-3">
                      <Field
                        id="iv-name"
                        label="Full name"
                        name="full_name"
                        required
                        maxLength={80}
                      />
                      <Field
                        id="iv-email"
                        label="Email"
                        name="email"
                        type="email"
                        required
                        defaultValue={invitePreview?.email ?? ""}
                      />
                      <Field
                        id="iv-pw"
                        label="Password"
                        name="password"
                        type="password"
                        required
                        minLength={6}
                      />
                      <SubmitBtn busy={busy}>Create account & join</SubmitBtn>
                    </form>
                  </TabsContent>
                  <TabsContent value="signin">
                    <GoogleBtn busy={busy} onClick={handleGoogle} />
                    <Divider />
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <Field id="ivs-email" label="Email" name="email" type="email" required />
                      <Field
                        id="ivs-pw"
                        label="Password"
                        name="password"
                        type="password"
                        required
                      />
                      <SubmitBtn busy={busy}>Sign in & join</SubmitBtn>
                    </form>
                  </TabsContent>
                </Tabs>
              )}
            </>
          ) : (
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-3 mb-6 bg-white/5">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
                <TabsTrigger value="member">Join</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <GoogleBtn busy={busy} onClick={handleGoogle} />
                <Divider />
                <form onSubmit={handleSignIn} className="space-y-4">
                  <Field id="si-email" label="Email" name="email" type="email" required />
                  <Field id="si-pw" label="Password" name="password" type="password" required />
                  <SubmitBtn busy={busy}>Sign in</SubmitBtn>
                </form>
                <ForgotPasswordLink onSend={handleResetSend} />
              </TabsContent>

              <TabsContent value="admin">
                <GoogleBtn busy={busy} onClick={handleGoogle} label="Continue with Google" />
                <Divider />
                <form onSubmit={handleAdminSignUp} className="space-y-3">
                  <Field
                    id="ad-org"
                    label="Organization name"
                    name="org_name"
                    required
                    maxLength={80}
                    placeholder="Acme HQ"
                  />
                  <Field
                    id="ad-type"
                    label="Workspace type"
                    name="org_type"
                    defaultValue="generic"
                    placeholder="school, factory, agency…"
                  />
                  <div className="h-px bg-white/5 my-2" />
                  <Field id="ad-name" label="Your name" name="full_name" required maxLength={80} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="ad-phone" label="Phone" name="phone" type="tel" maxLength={30} />
                    <Field
                      id="ad-pos"
                      label="Position"
                      name="position"
                      maxLength={60}
                      placeholder="Director"
                    />
                  </div>
                  <Field id="ad-email" label="Email" name="email" type="email" required />
                  <Field
                    id="ad-pw"
                    label="Password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                  />
                  <SubmitBtn busy={busy}>Create workspace</SubmitBtn>
                </form>
              </TabsContent>

              <TabsContent value="member">
                <form onSubmit={handleMemberSignUp} className="space-y-3">
                  <Field
                    id="mb-code"
                    label="CYM access code"
                    name="access_code"
                    required
                    placeholder="CYM-XXXX"
                    className="font-mono uppercase tracking-widest"
                  />
                  <Field
                    id="mb-cat"
                    label="Category / team"
                    name="category"
                    placeholder="Engineering, Grade 4, Night shift…"
                  />
                  <div className="h-px bg-white/5 my-2" />
                  <Field id="mb-name" label="Full name" name="full_name" required maxLength={80} />
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="mb-phone" label="Phone" name="phone" type="tel" maxLength={30} />
                    <Field
                      id="mb-pos"
                      label="Position"
                      name="position"
                      maxLength={60}
                      placeholder="Teacher"
                    />
                  </div>
                  <Field id="mb-email" label="Email" name="email" type="email" required />
                  <Field
                    id="mb-pw"
                    label="Password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                  />
                  <SubmitBtn busy={busy}>Join workspace</SubmitBtn>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </main>
  );
}

function GoogleBtn({
  busy,
  onClick,
  label = "Continue with Google",
}: {
  busy: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium transition hover:bg-white/10 disabled:opacity-50"
    >
      <svg width="16" height="16" viewBox="0 0 48 48">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3c-1.7 4.7-6.2 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4 5.6l6.2 5.2C42 35.8 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z"
        />
      </svg>
      {label}
    </button>
  );
}

function Divider() {
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-white/10" />
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        or
      </span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

function ForgotPasswordLink({ onSend }: { onSend: (email: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="mt-4 w-full text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          Forgot password?
        </button>
      </DialogTrigger>
      <DialogContent className="glass-strong">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">We'll send a reset link to your inbox.</p>
        <Input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-white/5 border-white/10"
        />
        <DialogFooter>
          <Button
            disabled={busy || !email}
            onClick={async () => {
              setBusy(true);
              await onSend(email);
              setBusy(false);
              setOpen(false);
            }}
            className="bg-frequency text-primary-foreground resonance-glow"
          >
            {busy ? "Sending…" : "Send reset link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  id,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
      >
        {label}
      </Label>
      <Input
        id={id}
        className={`bg-white/5 border-white/10 focus-visible:ring-primary/60 ${className ?? ""}`}
        {...props}
      />
    </div>
  );
}

function SubmitBtn({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <Button
      type="submit"
      disabled={busy}
      className="w-full bg-frequency text-primary-foreground resonance-glow hover:brightness-110"
    >
      {busy ? <CymaticWave className="h-4" bars={4} /> : children}
    </Button>
  );
}
