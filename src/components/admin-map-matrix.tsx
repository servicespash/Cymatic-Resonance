import { Component, ErrorInfo, ReactNode, useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMapEvents,
  useMap,
  LayersControl,
  ScaleControl,
  ZoomControl,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-control-geocoder/dist/Control.Geocoder.css";
import "leaflet-control-geocoder";
import L from "leaflet";
import { MapPin, Check, Search, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/lib/use-theme";

import { DEFAULT_FALLBACK_LOCATION, isValidLatLng } from "@/lib/geo";

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const isLeafletLatLng = (pos: L.LatLng | null | undefined): pos is L.LatLng => {
  if (!pos) return false;
  return isValidLatLng(pos.lat, pos.lng);
};

interface LocationData {
  lat: number;
  lng: number;
  radius: number;
}

interface AdminMapMatrixProps {
  location: LocationData | null;
  onChange: (loc: LocationData) => void;
}

class AdminMapBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("Admin Map exception handled:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-72 w-full flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <MapPin className="mb-2 size-6 text-accent" />
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            Map Matrix Standby
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-3 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition"
          >
            Reset Matrix View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MapUpdater({
  position,
  isFullscreen,
}: {
  position: L.LatLng | null;
  isFullscreen: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (isLeafletLatLng(position)) {
      try {
        const currentCenter = map.getCenter();
        if (
          !currentCenter ||
          isNaN(currentCenter.lat) ||
          isNaN(currentCenter.lng) ||
          Math.abs(currentCenter.lat - position.lat) > 1e-6 ||
          Math.abs(currentCenter.lng - position.lng) > 1e-6
        ) {
          map.flyTo(position, 16, { animate: true, duration: 1.5 });
        }
      } catch (err) {
        console.warn("Admin MapUpdater flyTo skipped:", err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, map]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {
        // ignore
      }
    }, 100);
    return () => clearTimeout(timeout);
  }, [isFullscreen, map]);

  return null;
}

function LocationMarker({
  position,
  radius,
  setPosition,
}: {
  position: L.LatLng | null;
  radius: number;
  setPosition: (pos: L.LatLng) => void;
}) {
  useMapEvents({
    click(e) {
      if (e.latlng && isValidLatLng(e.latlng.lat, e.latlng.lng)) {
        setPosition(e.latlng);
      }
    },
  });

  if (!isLeafletLatLng(position)) return null;

  const safeRadius = typeof radius === "number" && !isNaN(radius) && radius > 0 ? radius : 200;

  return (
    <>
      <Marker position={position}></Marker>
      <Circle
        center={position}
        pathOptions={{
          fillColor: "var(--color-accent)",
          color: "var(--color-accent)",
          weight: 1.5,
          fillOpacity: 0.15,
        }}
        radius={safeRadius}
      />
    </>
  );
}

export function AdminMapMatrix({ location, onChange }: AdminMapMatrixProps) {
  const { theme } = useTheme();
  const [position, setPosition] = useState<L.LatLng | null>(() => {
    if (
      location &&
      typeof location.lat === "number" &&
      typeof location.lng === "number" &&
      !isNaN(location.lat) &&
      !isNaN(location.lng)
    ) {
      return new L.LatLng(location.lat, location.lng);
    }
    return null;
  });
  const [radius, setRadius] = useState<number>(location?.radius || 200);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (
      location &&
      typeof location.lat === "number" &&
      typeof location.lng === "number" &&
      !isNaN(location.lat) &&
      !isNaN(location.lng)
    ) {
      const newPos = new L.LatLng(location.lat, location.lng);
      const latDiff = position ? Math.abs(position.lat - newPos.lat) : 1;
      const lngDiff = position ? Math.abs(position.lng - newPos.lng) : 1;

      // Use a larger epsilon (1e-6 is ~11cm precision) to prevent floating point loops
      if (!position || latDiff > 1e-6 || lngDiff > 1e-6) {
        setPosition(newPos);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.lat, location?.lng]);

  useEffect(() => {
    if (
      location &&
      typeof location.radius === "number" &&
      Math.abs(location.radius - radius) > 0.1
    ) {
      setRadius(location.radius);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.radius]);

  useEffect(() => {
    if (isLeafletLatLng(position)) {
      const latDiff = location ? Math.abs(location.lat - position.lat) : 1;
      const lngDiff = location ? Math.abs(location.lng - position.lng) : 1;

      // Only trigger onChange if the values significantly changed from the prop
      const hasChanged =
        !location ||
        latDiff > 1e-6 ||
        lngDiff > 1e-6 ||
        Math.abs((location.radius || 0) - radius) > 0.1;

      if (hasChanged) {
        onChange({ lat: position.lat, lng: position.lng, radius });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, radius, onChange]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery,
        )}`,
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lon);

        if (!isNaN(latNum) && !isNaN(lngNum)) {
          const newPos = new L.LatLng(latNum, lngNum);
          setPosition(newPos);
        } else {
          toast.error("Invalid location coordinates found.");
        }
      } else {
        toast.error("Location not found. Try different keywords.");
      }
    } catch (err) {
      toast.error("Search failed. Check your connection.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <RadiusButton
          label="Small Building (~50m)"
          active={radius === 50}
          onClick={() => setRadius(50)}
        />
        <RadiusButton
          label="Campus (~200m)"
          active={radius === 200}
          onClick={() => setRadius(200)}
        />
        <RadiusButton
          label="Large Zone (~500m)"
          active={radius === 500}
          onClick={() => setRadius(500)}
        />
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search place or coordinates (e.g., Kampala, Uganda)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-accent/50 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching || !searchQuery.trim()}
          className="bg-accent/20 text-accent px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[80px]"
        >
          {isSearching ? <Loader2 className="size-4 animate-spin" /> : "Search"}
        </button>
      </div>

      <AdminMapBoundary>
        <div
          className={
            isFullscreen
              ? "fixed inset-0 z-[9999] bg-background"
              : "rounded-xl overflow-hidden border border-white/10 h-72 bg-white/5 relative z-0 shadow-inner"
          }
        >
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute bottom-6 left-6 z-[1000] bg-background/90 text-foreground backdrop-blur border border-border p-2.5 rounded-xl shadow-lg hover:bg-muted transition"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
          </button>

          <MapContainer
            center={
              isLeafletLatLng(position)
                ? position
                : [DEFAULT_FALLBACK_LOCATION.lat, DEFAULT_FALLBACK_LOCATION.lng]
            }
            zoom={13}
            minZoom={3}
            maxZoom={20}
            zoomControl={false}
            style={{ height: "100%", width: "100%" }}
            preferCanvas={true}
            touchZoom={true}
            className={theme === "dark" ? "brightness-[0.85] contrast-[1.1] saturate-[0.8]" : ""}
          >
            <ZoomControl position="topright" />
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Cymatic Dark (Institutional)">
                <TileLayer
                  attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={20}
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Cymatic Light (Professional)">
                <TileLayer
                  attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={20}
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Satellite Precision">
                <TileLayer
                  attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            <ScaleControl position="bottomleft" />
            <MapGeocoder setPosition={setPosition} />
            <LocationMarker position={position} radius={radius} setPosition={setPosition} />
            <MapUpdater position={position} isFullscreen={isFullscreen} />

            {/* Resonance Pulse Overlay */}
            {isLeafletLatLng(position) && (
              <Circle
                center={position}
                radius={radius * 1.5}
                pathOptions={{
                  fillColor: "var(--color-accent)",
                  fillOpacity: 0.05,
                  color: "var(--color-accent)",
                  weight: 1,
                  dashArray: "4, 8",
                }}
                className="animate-pulse"
              />
            )}
          </MapContainer>
          {!position && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
              <div className="text-center">
                <MapPin className="size-8 mx-auto mb-2 text-accent" />
                <p className="font-mono text-xs text-white">
                  Search or click map to set Station Pin
                </p>
              </div>
            </div>
          )}
        </div>
      </AdminMapBoundary>
    </div>
  );
}

function RadiusButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-4 py-3 rounded-xl border text-left transition-colors text-xs font-mono tracking-wider ${
        active
          ? "bg-accent/10 border-accent text-accent"
          : "bg-white/5 border-white/10 hover:bg-white/10 text-muted-foreground"
      }`}
    >
      {active && <Check className="absolute right-3 top-1/2 -translate-y-1/2 size-4" />}
      {label}
    </button>
  );
}

function MapGeocoder({ setPosition }: { setPosition: (pos: L.LatLng) => void }) {
  const map = useMap();

  useEffect(() => {
    try {
      // @ts-expect-error - Leaflet Geocoder control is not properly typed in the current version
      const geocoder = L.Control.geocoder({
        defaultMarkGeocode: false,
        position: "topleft",
      })
        .on(
          "markgeocode",
          function (e: { geocode?: { center?: L.LatLng; bbox?: L.LatLngBoundsExpression } }) {
            const latlng = e.geocode?.center;
            if (latlng && isValidLatLng(latlng.lat, latlng.lng)) {
              setPosition(latlng);
              if (e.geocode?.bbox) {
                try {
                  map.fitBounds(e.geocode.bbox);
                } catch {
                  // ignore
                }
              }
            }
          },
        )
        .addTo(map);

      return () => {
        try {
          map.removeControl(geocoder);
        } catch {
          // ignore
        }
      };
    } catch (err) {
      console.warn("Geocoder control setup skipped:", err);
    }
  }, [map, setPosition]);

  return null;
}
