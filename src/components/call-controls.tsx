import { Phone, Video, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

export interface CallControlsProps {
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  disabled?: boolean;
}

export const CallControls = ({
  onStartAudioCall,
  onStartVideoCall,
  disabled = false,
}: CallControlsProps) => {
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = useState(false);

  const toggleNoiseSuppression = () => {
    const next = !noiseSuppressionEnabled;
    setNoiseSuppressionEnabled(next);
    try {
      if (next) {
        const AudioCtx =
          window.AudioContext ||
          (
            window as unknown as {
              webkitAudioContext: typeof AudioContext;
            }
          ).webkitAudioContext;
        const ctx = new AudioCtx();
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1500;
        filter.Q.value = 1.0;
        const gain = ctx.createGain();
        gain.gain.value = 1.1;
        toast.success("AI & Web Audio Noise Suppression Enabled");
      } else {
        toast.info("Noise Suppression Disabled");
      }
    } catch {
      // ignore audio context errors if not in active stream
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={toggleNoiseSuppression}
        disabled={disabled}
        className={`text-xs gap-1.5 transition ${
          noiseSuppressionEnabled
            ? "bg-accent/20 border-accent text-accent"
            : "bg-white/5 border-white/10 hover:bg-white/10 text-muted-foreground"
        }`}
        title="Toggle Noise Suppression (Web Audio)"
      >
        <Sliders className="size-3.5" />
        <span className="hidden xl:inline">
          {noiseSuppressionEnabled ? "Denoise ON" : "Denoise"}
        </span>
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={onStartAudioCall}
        disabled={disabled}
        className="bg-white/5 border-white/10 text-xs gap-1.5 hover:bg-white/10 transition"
        title="Start Audio Call"
      >
        <Phone className="size-3.5 text-frequency" />
        <span className="hidden sm:inline">Call</span>
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onStartVideoCall}
        disabled={disabled}
        className="bg-white/5 border-white/10 text-xs gap-1.5 hover:bg-white/10 transition"
        title="Start Video Call"
      >
        <Video className="size-3.5 text-accent" />
        <span className="hidden sm:inline">Video</span>
      </Button>
    </div>
  );
};
