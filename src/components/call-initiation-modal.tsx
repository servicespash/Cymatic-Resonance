import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, Video, X } from "lucide-react";

interface CallInitiationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInitiate: (kind: "audio" | "video") => void;
  targetName: string;
}

export const CallInitiationModal = ({
  isOpen,
  onClose,
  onInitiate,
  targetName,
}: CallInitiationModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass-strong sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Start Call</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Choose how you want to connect with <span className="text-foreground font-semibold">{targetName}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-6">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-3 h-32 bg-white/5 border-white/10 hover:bg-white/10 hover:border-accent/50 transition-all group"
            onClick={() => onInitiate("audio")}
          >
            <div className="p-3 rounded-full bg-accent/10 group-hover:bg-accent/20 transition-colors">
              <Phone className="size-6 text-accent" />
            </div>
            <span className="font-medium">Audio Call</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-3 h-32 bg-white/5 border-white/10 hover:bg-white/10 hover:border-accent/50 transition-all group"
            onClick={() => onInitiate("video")}
          >
            <div className="p-3 rounded-full bg-accent/10 group-hover:bg-accent/20 transition-colors">
              <Video className="size-6 text-accent" />
            </div>
            <span className="font-medium">Video Call</span>
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
