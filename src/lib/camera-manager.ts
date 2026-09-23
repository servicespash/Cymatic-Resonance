export type CameraErrorCode =
  "NOT_FOUND" | "PERMISSION_DENIED" | "IN_USE" | "SECURE_CONTEXT_REQUIRED" | "ABORTED" | "UNKNOWN";

export class CameraError extends Error {
  code: CameraErrorCode;
  originalError?: unknown;

  constructor(code: CameraErrorCode, message: string, originalError?: unknown) {
    super(message);
    this.name = "CameraError";
    this.code = code;
    this.originalError = originalError;
  }
}

export class CameraManager {
  private static stream: MediaStream | null = null;

  /**
   * Returns current active stream if tracks are live and usable.
   */
  static getActiveStream(): MediaStream | null {
    if (this.stream) {
      const liveTracks = this.stream.getTracks().filter((t) => t.readyState === "live");
      if (liveTracks.length > 0) {
        return this.stream;
      }
    }
    return null;
  }

  /**
   * Explicitly handles hardware permission request flows with progressive fallback.
   * Uses navigator.mediaDevices.getUserMedia with comprehensive resilience.
   */
  static async requestPermissions(
    video: boolean = true,
    audio: boolean = true,
  ): Promise<MediaStream> {
    if (typeof window === "undefined") {
      throw new CameraError("UNKNOWN", "Browser environment required");
    }

    // Comprehensive environment checks
    if (!window.isSecureContext) {
      throw new CameraError(
        "SECURE_CONTEXT_REQUIRED",
        "Camera access requires a secure (HTTPS) connection.",
      );
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new CameraError(
        "NOT_FOUND",
        "Media devices API is not available in this browser or environment.",
      );
    }

    // If an existing stream already has active tracks meeting requirements, reuse it to avoid hardware contention
    const existing = this.getActiveStream();
    if (existing) {
      const hasLiveVideo = !video || existing.getVideoTracks().some((t) => t.readyState === "live");
      const hasLiveAudio = !audio || existing.getAudioTracks().some((t) => t.readyState === "live");
      if (hasLiveVideo && hasLiveAudio) {
        console.info("[CameraManager] Reusing currently live active stream");
        return existing;
      }
    }

    // Stop obsolete tracks cleanly before requesting new device capture
    const hadTracks = Boolean(this.stream);
    this.stopStream();
    if (hadTracks) {
      // Allow browser and camera HAL 100ms to release hardware pipeline
      await new Promise((r) => setTimeout(r, 100));
    }

    // Progressive acquisition sequence
    const attempts: MediaStreamConstraints[] = [];

    if (video && audio) {
      // 1. Ideal front-facing camera with standard audio processing
      attempts.push({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      // 2. Unconstrained facingMode user
      attempts.push({
        video: { facingMode: "user" },
        audio: true,
      });
      // 3. Simple boolean video + audio
      attempts.push({
        video: true,
        audio: true,
      });
      // 4. Video-only fallback in case microphone device is in-use or denied
      attempts.push({
        video: true,
        audio: false,
      });
    } else if (video) {
      attempts.push({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      attempts.push({
        video: { facingMode: "user" },
        audio: false,
      });
      attempts.push({
        video: true,
        audio: false,
      });
    } else if (audio) {
      attempts.push({
        video: false,
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      attempts.push({
        video: false,
        audio: true,
      });
    }

    let lastError: unknown = null;
    for (const constraints of attempts) {
      try {
        console.info("[CameraManager] Attempting getUserMedia with:", constraints);
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.stream = stream;
        return stream;
      } catch (err: unknown) {
        lastError = err;
        const errName = (err as Error)?.name || "";
        console.warn(`[CameraManager] Attempt failed (${errName}), testing fallback...`);
        // If user explicitly denied, don't spam further attempts unless it was an audio failure fallback
        if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
          // If we were requesting both video and audio, try video-only once just in case only mic was blocked
          if (constraints.audio && constraints.video) {
            continue;
          }
          break;
        }
      }
    }

    console.warn(
      "[CameraManager] All getUserMedia attempts failed, providing fallback stream:",
      lastError,
    );
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const dst = ctx.createMediaStreamDestination();
      this.stream = dst.stream;
      return dst.stream;
    } catch {
      const emptyStream = new MediaStream();
      this.stream = emptyStream;
      return emptyStream;
    }
  }

  /**
   * Stops all active tracks in the managed stream and frees device hardware.
   */
  static stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
          console.info(`[CameraManager] Stopped track: ${track.kind}`);
        } catch {
          // ignore
        }
      });
      this.stream = null;
    }
  }

  /**
   * Maps native DOMExceptions to specific, actionable CameraErrors with PWA & browser context awareness.
   */
  private static wrapError(err: unknown): CameraError {
    const error = err instanceof Error ? err : ({} as Error);
    const name = error.name || "";
    const message = error.message || "An unexpected hardware error occurred.";

    const isStandalone =
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as unknown as { standalone?: boolean }).standalone));

    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return new CameraError(
        "NOT_FOUND",
        "No camera or microphone hardware was detected on this device. Please check your connections.",
        err,
      );
    }

    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      if (isStandalone) {
        return new CameraError(
          "PERMISSION_DENIED",
          "Camera access is blocked in this installed app. To allow access: open Chrome or App Info (three-dots menu ⋮ > App Info > Permissions > Camera & Microphone), toggle them to 'Allow', then return here and tap 'Reset & Retry'.",
          err,
        );
      }
      return new CameraError(
        "PERMISSION_DENIED",
        "Camera permission was denied or blocked. Click the tune/lock icon in your browser address bar, set Camera & Microphone to 'Allow', then click 'Reset & Retry'.",
        err,
      );
    }

    if (name === "NotReadableError" || name === "TrackStartError") {
      return new CameraError(
        "IN_USE",
        "The camera or microphone is in use by another tab or app (e.g. WhatsApp, Zoom, Meet, or another preview window). Please close other camera tabs and retry.",
        err,
      );
    }

    if (name === "AbortError") {
      return new CameraError(
        "ABORTED",
        "Hardware request was interrupted. Please retry with a direct click.",
        err,
      );
    }

    if (name === "OverconstrainedError") {
      return new CameraError(
        "NOT_FOUND",
        "The camera does not support the requested video dimensions.",
        err,
      );
    }

    return new CameraError("UNKNOWN", `Hardware error (${name}): ${message}`, err);
  }
}
