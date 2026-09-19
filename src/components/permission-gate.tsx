import { useState, useEffect, useRef } from "react";
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
  const [checking, setChecking] = useState(false);
  const hasTestedRef = useRef(false);

  const checkPermissions = async () => {
    setChecking(true);
    try {
      setErrorMessage(null);
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: videoRequired ? { width: { ideal: 640 }, height: { ideal: 360 } } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach((track) => track.stop());

      setStatus("granted");
      onGranted();
    } catch (err: unknown) {
      console.info("[PermissionGate] Media hardware permission skipped or denied:", err);
      setStatus("denied");
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setErrorMessage(
            "Camera and microphone access was denied. You can continue in Simulated / Audio-Only Mode below.",
          );
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setErrorMessage(
            "No camera or microphone hardware found. You can continue in Simulated Mode.",
          );
        } else {
          setErrorMessage(err.message || "Failed to access media hardware.");
        }
      } else {
        setErrorMessage(
          "Media access restricted in preview container. Use Simulated Mode to proceed.",
        );
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!hasTestedRef.current) {
      hasTestedRef.current = true;
      checkPermissions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "granted") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-accent/10 text-accent animate-pulse">
          {videoRequired ? <Camera className="size-8" /> : <Mic className="size-8" />}
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-display font-semibold">Camera & Microphone Access</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {videoRequired
              ? "Secure peer calling requires camera and microphone permissions, or you can run in simulated mode."
              : "Secure audio calling requires microphone permissions, or you can run in simulated mode."}
          </p>
        </div>

        {errorMessage && (
          <Alert variant="destructive" className="text-left text-xs">
            <AlertCircle className="size-4" />
            <AlertTitle>Hardware Notice</AlertTitle>
            <AlertDescription className="text-[11px]">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3 pt-2">
          <Button
            onClick={checkPermissions}
            disabled={checking}
            className="w-full gap-2 text-xs py-5 rounded-xl bg-accent text-accent-foreground font-semibold hover:brightness-110"
          >
            <Settings className="size-4" />
            {checking ? "Testing Hardware..." : "Grant Hardware Permissions"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setStatus("granted");
              onGranted();
            }}
            className="w-full text-xs py-5 rounded-xl font-semibold border-accent/40 text-accent hover:bg-accent/10"
          >
            Continue in Simulated / Audio-Only Mode
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Simulated mode bypasses physical hardware constraints so you can explore calls
            instantly.
          </p>
        </div>
      </div>
    </div>
  );
}
