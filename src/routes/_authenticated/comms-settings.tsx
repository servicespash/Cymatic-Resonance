import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CymaticWave } from "@/components/cymatic-wave";
import { toast } from "sonner";
import { Bell, Volume2, Music } from "lucide-react";

export const Route = createFileRoute("/_authenticated/comms-settings")({
  component: CommunicationsSettingsPage,
});

function CommunicationsSettingsPage() {
  const [volume, setVolume] = useState(80);
  const [notifications, setNotifications] = useState(true);
  const [ringtone, setRingtone] = useState("default");
  const [dialTone, setDialTone] = useState("default");
  const { user } = useAuth();

  useEffect(() => {
    if (user?.user_metadata) {
      setRingtone(user.user_metadata.ringtone || "default");
      setDialTone(user.user_metadata.dialTone || "default");
    }
  }, [user]);

  const saveSettings = async () => {
    const { error } = await supabase.auth.updateUser({
      data: { ringtone, dialTone }
    });
    
    if (error) {
        toast.error("Failed to save settings");
    } else {
        toast.success("Settings saved");
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-8">
      <h1 className="font-display text-3xl font-bold">Communication Settings</h1>

      <section className="glass rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold">Call Volume</h2>
              <p className="text-xs text-muted-foreground">Adjust incoming call volume</p>
            </div>
          </div>
          <input
            type="range"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-32"
          />
        </div>

        <div className="flex items-center justify-between border-t border-white/5 pt-6">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold">Desktop Notifications</h2>
              <p className="text-xs text-muted-foreground">Receive alerts for new messages</p>
            </div>
          </div>
          <button
            onClick={() => {
              setNotifications(!notifications);
              toast.success(`Notifications ${!notifications ? "enabled" : "disabled"}`);
            }}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
              notifications ? "bg-accent text-accent-foreground" : "bg-white/10"
            }`}
          >
            {notifications ? "Enabled" : "Disabled"}
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 pt-6">
          <div className="flex items-center gap-3">
            <Music className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold">Ringtone</h2>
              <p className="text-xs text-muted-foreground">Select incoming call tone</p>
            </div>
          </div>
          <select
            value={ringtone}
            onChange={(e) => setRingtone(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg p-2 text-sm"
          >
            <option value="default">Default</option>
            <option value="classic">Classic</option>
            <option value="modern">Modern</option>
          </select>
        </div>

        <div className="flex items-center justify-between border-t border-white/5 pt-6">
          <div className="flex items-center gap-3">
            <Music className="h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold">Dial Tone</h2>
              <p className="text-xs text-muted-foreground">Select outgoing dial tone</p>
            </div>
          </div>
          <select
            value={dialTone}
            onChange={(e) => setDialTone(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg p-2 text-sm"
          >
            <option value="default">Default</option>
            <option value="beep">Beep</option>
            <option value="ring">Ring</option>
          </select>
        </div>
        
        <button
            onClick={saveSettings}
            className="w-full bg-frequency text-primary-foreground py-2 rounded-lg font-medium"
        >
            Save Changes
        </button>
      </section>

      <div className="grid place-items-center py-10">
        <CymaticWave className="h-6" bars={6} />
      </div>
    </div>
  );
}
