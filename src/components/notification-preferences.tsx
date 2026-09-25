/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Mail, Zap, CheckCircle2, Phone, Smartphone } from "lucide-react";
import { SoundPicker } from "@/components/sound-picker";
import { toast } from "sonner";
import { triggerVibration } from "@/lib/vibration";

type Preferences = {
  email_notifications: boolean;
  task_alerts: boolean;
  pulse_alerts: boolean;
  call_ringtone: string;
  vibration_alerts: boolean;
};

export function NotificationPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>({
    email_notifications: true,
    task_alerts: true,
    pulse_alerts: true,
    call_ringtone: "default",
    vibration_alerts: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPrefs = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase.from("user_preferences" as any) as any)
      .select("email_notifications, task_alerts, pulse_alerts, call_ringtone, vibration_alerts")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setPrefs({
        email_notifications: data.email_notifications ?? true,
        task_alerts: data.task_alerts ?? true,
        pulse_alerts: data.pulse_alerts ?? true,
        call_ringtone: data.call_ringtone ?? "default",
        vibration_alerts: data.vibration_alerts ?? true,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const updatePref = async (key: keyof Preferences, value: boolean | string) => {
    if (!user) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setSaving(true);

    const { error } = await (supabase.from("user_preferences" as any) as any).upsert({
      user_id: user.id,
      ...updated,
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    if (error) {
      toast.error("Failed to save preferences");
      return;
    }
    triggerVibration();
    toast.success("Preferences updated", {
      icon: <CheckCircle2 className="size-4 text-emerald-400" />,
    });
  };

  if (loading) {
    return <div className="text-xs text-muted-foreground animate-pulse">Loading preferences…</div>;
  }

  return (
    <section className="glass rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Bell className="size-4 text-accent" />
        <h3 className="font-display text-lg font-semibold">Notification & Email Preferences</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Configure how and when the platform reaches you via Resend email delivery and real-time
        pings.
      </p>

      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Mail className="size-4 text-frequency" /> Email Notifications
            </Label>
            <p className="text-xs text-muted-foreground">
              Receive transactional emails and workspace updates via Resend
              (Latif@resonance.cymatichub.xyz).
            </p>
          </div>
          <Switch
            checked={prefs.email_notifications}
            onCheckedChange={(val) => updatePref("email_notifications", val)}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="size-4 text-accent" /> Task Assignment Alerts
            </Label>
            <p className="text-xs text-muted-foreground">
              Get notified immediately when you are assigned new tasks or deadlines approach.
            </p>
          </div>
          <Switch
            checked={prefs.task_alerts}
            onCheckedChange={(val) => updatePref("task_alerts", val)}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Zap className="size-4 text-amber-400" /> Pulse & Broadcast Pings
            </Label>
            <p className="text-xs text-muted-foreground">
              Receive real-time pulse alerts and emergency check-in notifications.
            </p>
          </div>
          <Switch
            checked={prefs.pulse_alerts}
            onCheckedChange={(val) => updatePref("pulse_alerts", val)}
            disabled={saving}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Smartphone className="size-4 text-accent" /> Vibration Alerts
            </Label>
            <p className="text-xs text-muted-foreground">
              Enable vibration for incoming calls and notifications.
            </p>
          </div>
          <Switch
            checked={prefs.vibration_alerts}
            onCheckedChange={(val) => updatePref("vibration_alerts", val)}
            disabled={saving}
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Phone className="size-4 text-accent" /> Call Ringtone
          </Label>
          <SoundPicker onSelect={(id) => updatePref("call_ringtone", id)} />
        </div>
      </div>
    </section>
  );
}
