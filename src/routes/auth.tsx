import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — Attendance" }] }),
});

const signUpSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  position: z.string().trim().max(60).optional().or(z.literal("")),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
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
    navigate({ to: "/" });
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: parsed.data.full_name,
          phone: parsed.data.phone,
          position: parsed.data.position,
        },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! You're signed in.");
    navigate({ to: "/" });
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--gradient-bg)" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground mt-1">Daily check-in for your team</p>
        </div>
        <div className="bg-card rounded-2xl p-6" style={{ boxShadow: "var(--shadow-soft)" }}>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="si-email">Email</Label><Input id="si-email" name="email" type="email" required /></div>
                <div className="space-y-2"><Label htmlFor="si-pw">Password</Label><Input id="si-pw" name="password" type="password" required /></div>
                <Button type="submit" disabled={busy} className="w-full" style={{ background: "var(--gradient-primary)" }}>{busy ? "Signing in..." : "Sign in"}</Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="su-name">Full name</Label><Input id="su-name" name="full_name" required maxLength={80} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor="su-phone">Phone</Label><Input id="su-phone" name="phone" type="tel" maxLength={30} /></div>
                  <div className="space-y-2"><Label htmlFor="su-pos">Position</Label><Input id="su-pos" name="position" maxLength={60} placeholder="Teacher" /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="su-email">Email</Label><Input id="su-email" name="email" type="email" required /></div>
                <div className="space-y-2"><Label htmlFor="su-pw">Password</Label><Input id="su-pw" name="password" type="password" required minLength={6} /></div>
                <Button type="submit" disabled={busy} className="w-full" style={{ background: "var(--gradient-primary)" }}>{busy ? "Creating..." : "Create account"}</Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}
