import { useState, useEffect, useCallback } from "react";
import { AlertCircle, Camera, Mic, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface PermissionGateProps {
  onGranted: () => void;
  videoRequired?: boolean;
}

export function PermissionGate({ onGranted, videoRequired = true }: PermissionGateProps) {
  const [status, setStatus] = useState<"prompt" | "granted" | "denied">("prompt");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkPermissions = useCallback(async () => {
    try {
      setErrorMessage(null);
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: videoRequired ? { width: { ideal: 640 }, height: { ideal: 360 } } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Stop all tracks immediately after test
      stream.getTracks().forEach((track) => track.stop());

      setStatus("granted");
      onGranted();
    } catch (err: unknown) {
      console.error("[PermissionGate] Media permission error:", err);
      setStatus("denied");
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setErrorMessage(
            "Camera and microphone access was denied. Please allow permission in your browser address bar and try again.",
          );
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setErrorMessage("No camera or microphone devices were found connected to your device.");
        } else {
          setErrorMessage(err.message || "Failed to access media hardware.");
        }
      } else {
        setErrorMessage("An unexpected hardware access error occurred.");
      }
    }
  }, [onGranted, videoRequired]);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  if (status === "granted") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-6 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent/10 text-accent">
          {videoRequired ? <Camera className="size-7" /> : <Mic className="size-7" />}
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-display font-semibold">Camera & Microphone Access</h2>
          <p className="text-sm text-muted-foreground">
            {videoRequired
              ? "This call requires access to your camera and microphone to establish secure peer streams."
              : "This call requires access to your microphone."}
          </p>
        </div>

        {errorMessage && (
          <Alert variant="destructive" className="text-left">
            <AlertCircle className="size-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          <Button onClick={checkPermissions} className="w-full gap-2">
            <Settings className="size-4" />
            Grant Hardware Permissions
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setStatus("granted");
              onGranted();
            }}
            className="w-full text-xs"
          >
            Continue in Simulated / Audio-Only Mode
          </Button>
          <p className="text-[11px] text-muted-foreground">
            If blocked, click the settings/lock icon in your browser's address bar to reset
            permissions or continue in simulated mode.
          </p>
        </div>
      </div>
    </div>
  );
}
