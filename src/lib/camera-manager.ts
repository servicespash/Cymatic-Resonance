export type CameraErrorCode =
  "NOT_FOUND" | "PERMISSION_DENIED" | "IN_USE" | "SECURE_CONTEXT_REQUIRED" | "ABORTED" | "UNKNOWN";

export interface CameraError {
  code: CameraErrorCode;
  message: string;
  originalError?: unknown;
}

export class CameraManager {
  private static stream: MediaStream | null = null;

  /**
   * Explicitly handles hardware permission request flows.
   * Uses navigator.mediaDevices.getUserMedia with comprehensive try-catch.
   */
  static async requestPermissions(
    video: boolean = true,
    audio: boolean = true,
  ): Promise<MediaStream> {
    this.stopStream();

    if (typeof window === "undefined") {
      throw this.wrapError(new Error("Browser environment required"));
    }

    // Comprehensive environment checks
    if (!window.isSecureContext) {
      throw {
        code: "SECURE_CONTEXT_REQUIRED",
        message: "Camera access requires a secure (HTTPS) connection.",
      } as CameraError;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw {
        code: "NOT_FOUND",
        message: "Media devices API not available in this browser or hardware.",
      } as CameraError;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        audio: audio,
      };

      console.info("[CameraManager] Initiating getUserMedia with constraints:", constraints);
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr: unknown) {
        const errObj = firstErr instanceof Error ? firstErr : ({} as Error);
        // If ideal resolution failed due to constraints or read issue, retry with standard unconstrained video
        if (
          video &&
          (errObj.name === "OverconstrainedError" || errObj.name === "ConstraintNotSatisfiedError")
        ) {
          console.warn(
            "[CameraManager] Ideal constraints failed, falling back to basic video/audio:",
            errObj.message,
          );
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio });
        } else {
          throw firstErr;
        }
      }
      this.stream = stream;
      return stream;
    } catch (err: unknown) {
      console.error("[CameraManager] getUserMedia failed:", err);
      throw this.wrapError(err);
    }
  }

  /**
   * Stops all active tracks in the managed stream.
   */
  static stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.stop();
        console.info(`[CameraManager] Stopped track: ${track.kind}`);
      });
      this.stream = null;
    }
  }

  /**
   * Maps native DOMExceptions to specific, actionable CameraErrors.
   */
  private static wrapError(err: unknown): CameraError {
    const error = err instanceof Error ? err : ({} as Error);
    const name = error.name || "";
    const message = error.message || "An unexpected hardware error occurred.";

    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return {
        code: "NOT_FOUND",
        message: "No camera or microphone hardware was detected. Please check your connections.",
        originalError: err,
      };
    }

    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return {
        code: "PERMISSION_DENIED",
        message:
          "Permission was denied. Please click the lock icon in your address bar to reset permissions.",
        originalError: err,
      };
    }

    if (name === "NotReadableError" || name === "TrackStartError") {
      return {
        code: "IN_USE",
        message:
          "The camera is being used by another application. Please close other apps and retry.",
        originalError: err,
      };
    }

    if (name === "AbortError") {
      return {
        code: "ABORTED",
        message:
          "The request was aborted. This can happen if the hardware is disconnected during the check.",
        originalError: err,
      };
    }

    if (name === "OverconstrainedError") {
      return {
        code: "NOT_FOUND",
        message: "The requested camera resolution is not supported by your hardware.",
        originalError: err,
      };
    }

    return {
      code: "UNKNOWN",
      message: `Hardware error (${name}): ${message}`,
      originalError: err,
    };
  }
}
