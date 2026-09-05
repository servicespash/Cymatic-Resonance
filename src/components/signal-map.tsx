import { MapContainer, TileLayer, Circle, Marker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import React, { Component, ErrorInfo, ReactNode, useEffect } from "react";
import { useTheme } from "@/lib/use-theme";
import { DEFAULT_FALLBACK_LOCATION, isValidLatLng, safeCoordinates } from "@/lib/geo";
import { MapPin } from "lucide-react";

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface SignalMapProps {
  center?: { lat?: number | null; lng?: number | null } | null;
  userPos?: { lat?: number | null; lng?: number | null } | null;
  radius?: number | null;
}

class MapBoundary extends Component<
  { children: ReactNode; fallbackText?: string },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; fallbackText?: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("Leaflet Map Rendering Exception handled safely:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-strong flex h-64 w-full flex-col items-center justify-center rounded-2xl border border-white/5 p-6 text-center">
          <MapPin className="mb-2 size-6 text-accent animate-pulse" />
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
            {this.props.fallbackText || "Station Signal Offline"}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white hover:bg-white/10 transition"
          >
            Reconnect Signal
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MapUpdater({ target }: { target: { lat: number; lng: number } | null | undefined }) {
  const map = useMap();

  useEffect(() => {
    if (target && isValidLatLng(target.lat, target.lng)) {
      try {
        const currentCenter = map.getCenter();
        if (currentCenter && isFinite(currentCenter.lat) && isFinite(currentCenter.lng)) {
          const latDiff = Math.abs(currentCenter.lat - target.lat);
          const lngDiff = Math.abs(currentCenter.lng - target.lng);

          // Only fly if the distance is significant to avoid infinite update loops
          if (latDiff > 1e-6 || lngDiff > 1e-6) {
            map.flyTo([target.lat, target.lng], 16, { animate: true, duration: 1.5 });
          }
        } else {
          map.setView([target.lat, target.lng], 16);
        }
      } catch (err) {
        console.warn("Map navigation safely skipped:", err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.lat, target?.lng, map]);

  return null;
}

export function SignalMap({ center, userPos, radius }: SignalMapProps) {
  const { theme } = useTheme();

  // Robust coordinate validation layer - always safe, never NaN
  const safeCenter = safeCoordinates(center?.lat, center?.lng, DEFAULT_FALLBACK_LOCATION);
  const userPosValid =
    userPos && isValidLatLng(userPos.lat, userPos.lng) && safeCoordinates(userPos.lat, userPos.lng);

  const safeRadius =
    typeof radius === "number" && !isNaN(radius) && radius > 0
      ? radius
      : DEFAULT_FALLBACK_LOCATION.radius;

  const focusTarget = userPosValid
    ? { lat: userPosValid.lat, lng: userPosValid.lng }
    : { lat: safeCenter.lat, lng: safeCenter.lng };

  return (
    <MapBoundary fallbackText="Signal Matrix Initializing">
      <div className="glass-strong relative h-64 w-full overflow-hidden rounded-2xl border border-white/5 shadow-2xl">
        <MapContainer
          center={[safeCenter.lat, safeCenter.lng]}
          zoom={15}
          zoomControl={false}
          scrollWheelZoom={false}
          dragging={true}
          style={{ height: "100%", width: "100%" }}
          className={theme === "dark" ? "brightness-[0.85] contrast-[1.1] saturate-[0.8]" : ""}
        >
          <TileLayer
            attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            maxZoom={20}
          />

          {/* Station Boundary */}
          <Circle
            center={[safeCenter.lat, safeCenter.lng]}
            radius={safeRadius}
            pathOptions={{
              fillColor: "var(--color-accent)",
              fillOpacity: 0.1,
              color: "var(--color-accent)",
              weight: 1,
              dashArray: "5, 10",
            }}
          />

          {/* User Resonance Pulse */}
          {userPosValid && (
            <>
              <Marker position={[userPosValid.lat, userPosValid.lng]} />
              <Circle
                center={[userPosValid.lat, userPosValid.lng]}
                radius={30}
                pathOptions={{
                  fillColor: "var(--color-accent)",
                  fillOpacity: 0.3,
                  color: "var(--color-accent)",
                  weight: 2,
                }}
                className="animate-pulse"
              />
            </>
          )}

          <MapUpdater target={focusTarget} />
        </MapContainer>

        <div className="absolute bottom-4 left-4 z-[1000] rounded-full border border-white/10 bg-black/40 px-3 py-1 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            <span className="font-mono text-[9px] uppercase tracking-widest text-white">
              Live Signal Map
            </span>
          </div>
        </div>
      </div>
    </MapBoundary>
  );
}
