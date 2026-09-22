import { useState, useEffect, useRef, useCallback } from "react";
import { AlertCircle, Camera, Mic, Settings, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CameraManager } from "@/lib/camera-manager";

interface PermissionGateProps {
  onGranted: () => void;
  videoRequired?: boolean;
}

const MANUAL_KEY = "cym.media.mode.v1";

type Diagnostics = {
  secureContext: boolean;
  hasMediaDevices: boolean;
  camera: string;
  microphone: string;
  cams: number;
  mics: number;
};

export function PermissionGate({ onGranted, videoRequired = true }: PermissionGateProps) {
  const [status, setStatus] = useState<"prompt" | "granted" | "denied" | "verified">("prompt");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [diag, setDiag] = useState<Diagnostics | null>(null);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasTestedRef = useRef(false);

  useEffect(() => {
    if (previewStream && videoRef.current) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  const stopPreview = useCallback(() => {
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
      setPreviewStream(null);
    }
  }, [previewStream]);

  const runDiagnostics = useCallback(async () => {
    const secureContext = typeof window !== "undefined" && window.isSecureContext;
    const hasMediaDevices = Boolean(navigator.mediaDevices?.getUserMedia);
    let camera = "unknown";
    let microphone = "unknown";
    try {
      const perms = navigator.permissions as unknown as
        { query: (d: { name: string }) => Promise<{ state: string }> } | undefined;
      if (perms?.query) {
        camera = (await perms.query({ name: "camera" }).catch(() => ({ state: "unknown" }))).state;
        microphone = (await perms.query({ name: "microphone" }).catch(() => ({ state: "unknown" })))
          .state;
      }
    } catch {
      // permissions API unsupported
    }
    let cams = 0;
    let mics = 0;
    try {
      const devices = (await navigator.mediaDevices?.enumerateDevices()) ?? [];
      cams = devices.filter((d) => d.kind === "videoinput").length;
      mics = devices.filter((d) => d.kind === "audioinput").length;
    } catch {
      // device listing blocked
    }
    const result = { secureContext, hasMediaDevices, camera, microphone, cams, mics };
    console.info("[PermissionGate] diagnostics:", result);
    setDiag(result);
    return result;
  }, []);

  const checkPermissions = useCallback(async () => {
    setChecking(true);
    setErrorMessage(null);
    const timeoutId = setTimeout(() => {
      if (checking) {
        setErrorMessage(
          "Permission request is taking longer than expected. You might need to check your system settings or another app using the camera.",
        );
      }
    }, 10000);

    try {
      const info = await runDiagnostics();

      if (!info.secureContext) {
        setErrorMessage("Secure context (HTTPS) is required for camera access.");
        return;
      }

      const stream = await CameraManager.requestPermissions(videoRequired, true);
      console.info("[PermissionGate] CameraManager success.");

      setPreviewStream(stream);
      setStatus("verified");

      try {
        localStorage.setItem(MANUAL_KEY, "hardware");
      } catch {
        // ignore
      }
    } catch (err: unknown) {
      console.info("[PermissionGate] Media hardware failure:", err);
      setStatus("denied");
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to access media hardware. Please check your settings.";
      setErrorMessage(msg);
    } finally {
      clearTimeout(timeoutId);
      setChecking(false);
    }
  }, [runDiagnostics, videoRequired, checking]);

  useEffect(() => {
    if (hasTestedRef.current) return;
    hasTestedRef.current = true;
    let remembered: string | null = null;
    try {
      remembered = localStorage.getItem(MANUAL_KEY);
    } catch {
      // ignore
    }
    if (remembered === "simulated") {
      setStatus("verified");
      return;
    }
    void checkPermissions();
  }, [checkPermissions]);

  if (status === "granted") return null;

  const handleJoin = () => {
    stopPreview();
    setStatus("granted");
    onGranted();
  };

  const chip = (label: string, value: string | number, good: boolean) => (
    <span
      key={label}
      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
        good ? "bg-frequency/15 text-frequency" : "bg-destructive/10 text-destructive"
      }`}
    >
      {label}: {value}
    </span>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-5 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-accent/10 text-accent animate-pulse">
          {videoRequired ? <Camera className="size-8" /> : <Mic className="size-8" />}
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-display font-semibold">Camera &amp; Microphone Access</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {videoRequired
              ? "Secure peer calling needs camera and microphone permission, or you can run in simulated mode."
              : "Secure audio calling needs microphone permission, or you can run in simulated mode."}
          </p>
        </div>

        {errorMessage && (
          <Alert variant="destructive" className="text-left text-xs">
            <AlertCircle className="size-4" />
            <AlertTitle>Hardware Notice</AlertTitle>
            <AlertDescription className="text-[11px]">{errorMessage}</AlertDescription>
          </Alert>
        )}

        {diag && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {chip("https", diag.secureContext ? "yes" : "no", diag.secureContext)}
            {chip("camera", diag.camera, diag.camera === "granted" || status === "verified")}
            {chip("mic", diag.microphone, diag.microphone === "granted" || status === "verified")}
            {chip("devices", `${diag.cams}v/${diag.mics}a`, diag.cams + diag.mics > 0)}
          </div>
        )}

        {status === "verified" && previewStream && videoRequired && (
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black/20 ring-1 ring-frequency/20 animate-in fade-in zoom-in duration-500">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="size-full object-cover mirror"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
              <p className="text-[10px] text-white font-medium flex items-center gap-1.5">
                <CheckCircle2 className="size-3 text-frequency" />
                Live Hardware Preview Active
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 pt-1">
          {status === "verified" ? (
            <Button
              onClick={handleJoin}
              className="w-full gap-2 text-sm py-6 rounded-xl bg-frequency text-frequency-foreground font-bold resonance-glow animate-pulse-glow"
            >
              <CheckCircle2 className="size-5" />
              Enter Secure Room
            </Button>
          ) : (
            <>
              <Button
                onClick={checkPermissions}
                disabled={checking}
                className="w-full gap-2 text-xs py-5 rounded-xl bg-accent text-accent-foreground font-semibold hover:brightness-110"
              >
                {checking ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Settings className="size-4" />
                )}
                {checking ? "Testing hardware..." : "Grant hardware permissions"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  try {
                    localStorage.setItem(MANUAL_KEY, "simulated");
                  } catch {
                    // ignore
                  }
                  handleJoin();
                }}
                className="w-full gap-2 text-xs py-5 rounded-xl font-semibold border-accent/40 text-accent hover:bg-accent/10"
              >
                <CheckCircle2 className="size-4" />
                Always continue in simulated / audio-only mode
              </Button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              CameraManager.stopStream();
              try {
                localStorage.removeItem(MANUAL_KEY);
              } catch {
                // ignore
              }
              stopPreview();
              void checkPermissions();
            }}
            className="text-[10px] text-muted-foreground underline underline-offset-2 flex items-center gap-1 mx-auto mt-2 hover:text-foreground transition-colors"
          >
            <RefreshCw className="size-2.5" />
            Reset & Retry Hardware Detection
          </button>
        </div>
      </div>
    </div>
  );
}
