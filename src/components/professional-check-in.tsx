import { LucideIcon, MapPin, Navigation, Signal, Target } from "lucide-react";
import {
  calculateCoordinatesDistance,
  formatDistance,
  isValidLatLng,
  safeCoordinates,
} from "@/lib/geo";

interface ProfessionalCheckInProps {
  status: string;
  variance?: number | null;
  lat?: number | null;
  lng?: number | null;
  referencePoint?: { lat: number; lng: number } | null;
  isLate?: boolean;
}

export function ProfessionalCheckIn({
  status,
  variance,
  lat,
  lng,
  referencePoint,
  isLate,
}: ProfessionalCheckInProps) {
  // Validate coordinates safely
  const userCoords = safeCoordinates(lat, lng);
  const coordsValid = userCoords.isValid;

  // Calculate or format distance to reference point
  let effectiveDistance = variance;
  if (referencePoint && isValidLatLng(referencePoint.lat, referencePoint.lng) && coordsValid) {
    effectiveDistance = calculateCoordinatesDistance(
      { lat: userCoords.lat, lng: userCoords.lng },
      referencePoint,
    );
  }

  const distanceStr = formatDistance(effectiveDistance);

  const statusConfig: Record<string, { label: string; color: string; icon: LucideIcon }> = {
    verified: { label: "Signal Locked", color: "text-accent", icon: Signal },
    external: { label: "External Pulse", color: "text-amber-400", icon: Navigation },
    denied: { label: "Signal Rejected", color: "text-destructive", icon: Target },
    unverified: { label: "Unverified Signal", color: "text-muted-foreground", icon: MapPin },
  };

  const config = statusConfig[status] || statusConfig.unverified;

  return (
    <div className="glass-strong rounded-2xl border border-white/5 p-4 shadow-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex size-10 items-center justify-center rounded-xl bg-white/5">
            <config.icon className={`size-5 ${config.color}`} />
            {status === "verified" && (
              <span className="absolute -right-0.5 -top-0.5 size-2.5 animate-ping rounded-full bg-accent opacity-75" />
            )}
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Resonance Status
            </div>
            <div className={`font-display text-sm font-bold tracking-tight ${config.color}`}>
              {config.label}
              {isLate && (
                <span className="ml-2 text-[10px] font-medium text-amber-500/80 uppercase tracking-widest">
                  · Late Pulse
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:flex sm:gap-6">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Station Distance
            </div>
            <div className="mt-0.5 font-mono text-xs font-semibold text-white">{distanceStr}</div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
              Telemetry
            </div>
            <div className="mt-0.5 font-mono text-xs font-semibold text-white">
              {coordsValid
                ? `${userCoords.lat.toFixed(4)}, ${userCoords.lng.toFixed(4)}`
                : "Fallback Station"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
