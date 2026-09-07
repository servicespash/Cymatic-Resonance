import { Component, ErrorInfo, ReactNode, useEffect, useState, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  Polyline,
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
import { useMapContext } from "@/context/map-context";

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
  onChange?: (loc: LocationData) => void;
  readOnly?: boolean;
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
}: {
  position: L.LatLng | null;
}) {
  const map = useMap();
  const { isFullscreen } = useMapContext();
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
  readOnly,
}: {
  position: L.LatLng | null;
  radius: number;
  setPosition: (pos: L.LatLng) => void;
  readOnly: boolean;
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

  const icon = L.divIcon({
    className: "bg-accent rounded-full size-4 border-2 border-white",
    html: "",
  });

  return (
    <>
      <Marker position={position} icon={!readOnly ? icon : undefined}></Marker>
      {!readOnly && (
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
      )}
    </>
  );
}

export function AdminMapMatrix({ location, onChange, readOnly = false }: AdminMapMatrixProps) {
  const { theme } = useTheme();
  const { isFullscreen, toggleFullscreen } = useMapContext();
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
  const [isTracking, setIsTracking] = useState(false);
  const [trackPath, setTrackPath] = useState<L.LatLng[]>([]);
  const mapRef = useRef<L.Map>(null);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const toggleTracking = () => {
    if (isTracking) {
      setIsTracking(false);
      setTrackPath([]);
    } else {
      setIsTracking(true);
      setTrackPath(position ? [position] : []);
    }
  };

  useEffect(() => {
    let watchId: number;
    if (isTracking) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = new L.LatLng(pos.coords.latitude, pos.coords.longitude);
          setPosition(newPos);
          setTrackPath((prev) => [...prev, newPos]);
        },
        (err) => toast.error(`Tracking error: ${err.message}`),
        { enableHighAccuracy: true },
      );
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTracking]);

  const locateMe = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(new L.LatLng(pos.coords.latitude, pos.coords.longitude));
      },
      (err) => toast.error(`Location error: ${err.message}`),
      { enableHighAccuracy: true },
    );
  };

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

      if (onChange && hasChanged) {
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
      {/* ... (radius buttons and search input) ... */}
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
              ? "fixed inset-0 z-[10000] w-screen h-screen bg-background overflow-hidden"
              : "rounded-xl overflow-hidden border border-white/10 h-72 bg-white/5 relative z-0 shadow-inner"
          }
        >
          <button
            type="button"
            onClick={toggleFullscreen}
            className="absolute bottom-6 left-6 z-[10001] bg-background/90 text-foreground backdrop-blur border border-border p-2.5 rounded-xl shadow-lg hover:bg-muted transition"
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
          </button>
          
          {!readOnly && (
            <div className="absolute bottom-6 right-6 z-[10001] flex gap-2">
              <button
                onClick={locateMe}
                className="bg-background/90 text-foreground backdrop-blur border border-border p-2.5 rounded-xl shadow-lg hover:bg-muted transition text-xs font-mono"
              >
                Locate
              </button>
              <button
                onClick={toggleTracking}
                className={`${
                  isTracking ? "bg-red-500 text-white" : "bg-background/90 text-foreground"
                } backdrop-blur border border-border p-2.5 rounded-xl shadow-lg hover:bg-muted transition text-xs font-mono`}
              >
                {isTracking ? "Stop" : "Track"}
              </button>
            </div>
          )}

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
            {/* ... map layers and controls ... */}
            <ZoomControl position="topright" />
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Terrain (Esri)">
                <TileLayer
                  attribution="Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
                  minZoom={2}
                  maxZoom={21}
                  maxNativeZoom={19}
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="OpenStreetMap">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                  minZoom={2}
                  maxZoom={21}
                  maxNativeZoom={19}
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            <ScaleControl position="bottomleft" />
            <MapGeocoder setPosition={setPosition} />
            <LocationMarker position={position} radius={radius} setPosition={setPosition} readOnly={readOnly} />
            <MapUpdater position={position} />

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
            {/* Live Tracking Path */}
            {isTracking && trackPath.length > 1 && (
              <Polyline positions={trackPath} pathOptions={{ color: "var(--color-accent)", weight: 4 }} />
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
