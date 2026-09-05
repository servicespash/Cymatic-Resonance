import { useEffect, useState } from "react";
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

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface LocationData {
  lat: number;
  lng: number;
  radius: number;
}

interface AdminMapMatrixProps {
  location: LocationData | null;
  onChange: (loc: LocationData) => void;
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
    if (
      position &&
      typeof position.lat === "number" &&
      typeof position.lng === "number" &&
      !isNaN(position.lat) &&
      !isNaN(position.lng)
    ) {
      map.flyTo(position, 16, { animate: true, duration: 1.5 });
    }
  }, [position, map]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      map.invalidateSize();
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
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
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
        radius={radius}
      />
    </>
  );
}

export function AdminMapMatrix({ location, onChange }: AdminMapMatrixProps) {
  const { theme } = useTheme();
  const [position, setPosition] = useState<L.LatLng | null>(
    location && !isNaN(location.lat) && !isNaN(location.lng)
      ? new L.LatLng(location.lat, location.lng)
      : null,
  );
  const [radius, setRadius] = useState<number>(location?.radius || 200);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (location && !isNaN(location.lat) && !isNaN(location.lng)) {
      setPosition(new L.LatLng(location.lat, location.lng));
    }
  }, [location]);

  useEffect(() => {
    if (position && !isNaN(position.lat) && !isNaN(position.lng)) {
      onChange({ lat: position.lat, lng: position.lng, radius });
    }
  }, [position, radius, onChange]);

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
          center={position || [0.3476, 32.5825]} // Default Kampala/Uganda
          zoom={13}
          minZoom={3}
          maxZoom={18}
          zoomControl={false}
          style={{ height: "100%", width: "100%" }}
          preferCanvas={true}
          touchZoom={true}
          className={theme === "dark" ? "brightness-90 contrast-125" : ""}
        >
          <ZoomControl position="topright" />
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OpenStreetMap (Street)">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
                detectRetina={true}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="OpenTopoMap (Terrain)">
              <TileLayer
                attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
                url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                maxZoom={17}
                detectRetina={true}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Esri Satellite">
              <TileLayer
                attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
                detectRetina={true}
              />
            </LayersControl.BaseLayer>
          </LayersControl>

          <ScaleControl position="bottomleft" />
          <MapGeocoder setPosition={setPosition} />
          <LocationMarker position={position} radius={radius} setPosition={setPosition} />
          <MapUpdater position={position} isFullscreen={isFullscreen} />
        </MapContainer>
        {!position && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
            <div className="text-center">
              <MapPin className="size-8 mx-auto mb-2 text-accent" />
              <p className="font-mono text-xs text-white">Search or click map to set Station Pin</p>
            </div>
          </div>
        )}
      </div>
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
    // @ts-expect-error - Leaflet Geocoder control is not properly typed in the current version
    const geocoder = L.Control.geocoder({
      defaultMarkGeocode: false,
      position: "topleft",
    })
      .on(
        "markgeocode",
        function (e: { geocode: { center: L.LatLng; bbox: L.LatLngBoundsExpression } }) {
          const latlng = e.geocode.center;
          setPosition(latlng);
          map.fitBounds(e.geocode.bbox);
        },
      )
      .addTo(map);

    return () => {
      map.removeControl(geocoder);
    };
  }, [map, setPosition]);

  return null;
}
