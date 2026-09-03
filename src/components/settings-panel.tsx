import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, Volume2, Palette, RefreshCcw } from "lucide-react";

export function SettingsPanel() {
  const [vibration, setVibration] = useState(50);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="rounded-lg p-2 hover:bg-white/5" aria-label="Settings">
          <Settings className="h-5 w-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="glass-strong w-full max-w-sm">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Volume2 className="h-4 w-4" /> Vibration Intensity
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={vibration}
              onChange={(e) => setVibration(Number(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Palette className="h-4 w-4" /> Theme Preference
            </label>
            <button className="w-full px-3 py-2 bg-white/5 rounded-lg text-left text-sm hover:bg-white/10">
              Toggle Light/Dark
            </button>
          </div>
          <div className="space-y-2 pt-4 border-t border-white/5">
            <button
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-lg text-sm hover:bg-destructive/20"
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
            >
              <RefreshCcw className="h-4 w-4" /> Reset Local Cache
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
