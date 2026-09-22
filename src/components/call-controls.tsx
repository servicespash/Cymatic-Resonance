import { Phone, Video, Sliders, Mic, MicOff, Volume2, VolumeX, Speaker } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export interface CallControlsProps {
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
  localStream?: MediaStream | null;
  disabled?: boolean;
}

export const CallControls = ({
  onStartAudioCall,
  onStartVideoCall,
  localStream,
  disabled = false,
}: CallControlsProps) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [volume, setVolume] = useState(100);

  const toggleMute = () => {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => track.enabled = isMuted);
        setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = () => {
      setIsSpeakerOn(!isSpeakerOn);
      // Implementation depends on actual HTMLAudioElement management
  };

  const handleVolumeChange = (value: number[]) => {
      setVolume(value[0]);
      // Implementation depends on actual HTMLAudioElement management
  };

  return (
    <div className="flex items-center gap-2">
      <Button size="icon" variant="ghost" onClick={toggleMute}>
          {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
      </Button>
      <Button size="icon" variant="ghost" onClick={toggleSpeaker}>
          {isSpeakerOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      </Button>
      <div className="w-24">
        <Slider value={[volume]} onValueChange={handleVolumeChange} max={100} step={1} />
      </div>
      
      <Button size="sm" variant="outline" onClick={onStartAudioCall} disabled={disabled} className="bg-white/5 border-white/10 text-xs gap-1.5 hover:bg-white/10 transition">
        <Phone className="size-3.5 text-frequency" /> Call
      </Button>
      <Button size="sm" variant="outline" onClick={onStartVideoCall} disabled={disabled} className="bg-white/5 border-white/10 text-xs gap-1.5 hover:bg-white/10 transition">
        <Video className="size-3.5 text-accent" /> Video
      </Button>
    </div>
  );
};
