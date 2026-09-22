import { useState, useEffect, useRef, useCallback } from "react";
import {
  AlertCircle,
  Camera,
  Mic,
  Settings,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
  ShieldAlert,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CameraManager } from "@/lib/camera-manager";

interface PermissionGateProps {
  onGranted: () => void;
  onCancel?: () => void;
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
  isPwa: boolean;
};

export function PermissionGate({ onGranted, onCancel, videoRequired = true }: PermissionGateProps) {
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
      previewStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      setPreviewStream(null);
    }
  }, [previewStream]);

  const runDiagnostics = useCallback(async () => {
    const secureContext = typeof window !== "undefined" && window.isSecureContext;
    const hasMediaDevices = Boolean(navigator.mediaDevices?.getUserMedia);
    const isPwa =
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as unknown as { standalone?: boolean }).standalone));

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
    const result: Diagnostics = {
      secureContext,
      hasMediaDevices,
      camera,
      microphone,
      cams,
      mics,
      isPwa,
    };
    console.info("[PermissionGate] diagnostics:", result);
    setDiag(result);
    return result;
  }, []);

  const checkPermissions = useCallback(async () => {
    setChecking(true);
    setErrorMessage(null);

    try {
      const info = await runDiagnostics();

      if (!info.secureContext) {
        setErrorMessage("Secure context (HTTPS) is required for camera and microphone access.");
        setStatus("denied");
        return;
      }

      // Request stream through CameraManager
      const stream = await CameraManager.requestPermissions(videoRequired, true);
      console.info("[PermissionGate] CameraManager success:", stream.id);

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
        (err as Error)?.message ||
        "Failed to access media hardware. Please verify system and browser permissions.";
      setErrorMessage(msg);
    } finally {
      setChecking(false);
    }
  }, [runDiagnostics, videoRequired]);

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
    // Note: We intentionally do NOT stop previewStream here so the verified
    // stream is handed off seamlessly to useLiveKitCall without re-prompting or device lock.
    setStatus("granted");
    onGranted();
  };

  const handleCancel = () => {
    stopPreview();
    CameraManager.stopStream();
    if (onCancel) {
      onCancel();
    }
  };

  const chip = (label: string, value: string | number, good: boolean) => (
    <span
      key={label}
      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
        good ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/10 text-destructive"
      }`}
    >
      {label}: {value}
    </span>
  );

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/90 backdrop-blur-md p-4 animate-fade-in pointer-events-auto select-none">
      <div className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-5 text-center pointer-events-auto relative">
        {onCancel && (
          <button
            type="button"
            onClick={handleCancel}
            className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Close / Cancel Call"
          >
            <X className="size-4" />
          </button>
        )}

        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-accent/10 text-accent animate-pulse">
          {videoRequired ? <Camera className="size-8" /> : <Mic className="size-8" />}
        </div>

        <div className="space-y-1.5">
          <h2 className="text-xl font-display font-semibold">Camera &amp; Microphone Access</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {videoRequired
              ? "Peer video calling requires camera and microphone authorization, or you can enter immediately in audio / simulated mode."
              : "Peer calling requires microphone authorization, or you can enter immediately in audio / simulated mode."}
          </p>
        </div>

        {diag && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {chip("https", diag.secureContext ? "secure" : "insecure", diag.secureContext)}
            {chip("camera", diag.camera, diag.camera === "granted" || status === "verified")}
            {chip("mic", diag.microphone, diag.microphone === "granted" || status === "verified")}
            {chip("devices", `${diag.cams}cam/${diag.mics}mic`, diag.cams + diag.mics > 0)}
            {diag.isPwa && chip("mode", "PWA App", true)}
          </div>
        )}

        {errorMessage && (
          <Alert variant="destructive" className="text-left text-xs space-y-1">
            <AlertCircle className="size-4" />
            <AlertTitle className="font-semibold text-xs">Camera / Hardware Notice</AlertTitle>
            <AlertDescription className="text-[11px] leading-relaxed">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        {status === "denied" && (
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-left space-y-2 text-xs text-amber-200">
            <div className="flex items-center gap-1.5 font-semibold text-amber-400">
              <ShieldAlert className="size-4 shrink-0" />
              <span>How to re-enable permission:</span>
            </div>
            {diag?.isPwa ? (
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <p className="flex items-start gap-1">
                  <Smartphone className="size-3.5 mt-0.5 shrink-0 text-amber-400" />
                  <span>
                    <strong>In this installed App:</strong> Tap the window title menu (⋮) &gt; App
                    Info &gt; Permissions, and switch <strong>Camera</strong> to <em>Allow</em>.
                  </span>
                </p>
                <p>
                  <strong>On Android:</strong> Settings &gt; Apps &gt; Cymatic Resonance &gt;
                  Permissions &gt; Camera &gt; Allow.
                </p>
              </div>
            ) : (
              <div className="space-y-1 text-[11px] text-muted-foreground">
                <p>
                  Click the <strong>Tune / Lock icon</strong> in your browser&apos;s address bar,
                  set <strong>Camera</strong> and <strong>Microphone</strong> to <em>Allow</em>,
                  then click <strong>Reset &amp; Retry</strong> below.
                </p>
              </div>
            )}
          </div>
        )}

        {status === "verified" && previewStream && videoRequired && (
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black/20 ring-1 ring-emerald-500/40 animate-in fade-in zoom-in duration-300">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="size-full object-cover mirror"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
              <p className="text-[10px] text-white font-medium flex items-center gap-1.5">
                <CheckCircle2 className="size-3 text-emerald-400" />
                Live Camera Hardware Ready
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2.5 pt-1">
          {status === "verified" ? (
            <Button
              type="button"
              onClick={handleJoin}
              className="w-full gap-2 text-sm py-6 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all"
            >
              <CheckCircle2 className="size-5" />
              Enter Secure Room
            </Button>
          ) : (
            <>
              <Button
                type="button"
                onClick={checkPermissions}
                disabled={checking}
                className="w-full gap-2 text-xs py-5 rounded-xl bg-primary text-primary-foreground font-semibold hover:brightness-110 active:scale-[0.98] transition-all"
              >
                {checking ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Settings className="size-4" />
                )}
                {checking ? "Requesting hardware..." : "Grant hardware permissions"}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  try {
                    localStorage.setItem(MANUAL_KEY, "simulated");
                  } catch {
                    // ignore
                  }
                  handleJoin();
                }}
                className="w-full gap-2 text-xs py-5 rounded-xl font-semibold border-border hover:bg-accent/10 active:scale-[0.98] transition-all"
              >
                <CheckCircle2 className="size-4" />
                Always continue in simulated / audio-only mode
              </Button>
            </>
          )}

          <div className="flex items-center justify-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => {
                stopPreview();
                CameraManager.stopStream();
                try {
                  localStorage.removeItem(MANUAL_KEY);
                } catch {
                  // ignore
                }
                void checkPermissions();
              }}
              className="text-[11px] text-muted-foreground underline underline-offset-4 flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
            >
              <RefreshCw className="size-3" />
              Reset &amp; Retry Hardware Detection
            </button>

            {onCancel && (
              <button
                type="button"
                onClick={handleCancel}
                className="text-[11px] text-destructive hover:underline transition-colors cursor-pointer"
              >
                Cancel &amp; Exit Call
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
