import { useState, useEffect, useCallback } from "react";
import L from "leaflet";
import { toast } from "sonner";

const TRACKING_STORAGE_KEY = "cymatic_map_tracking_path";

export function useMapTracking(isTracking: boolean) {
  const [trackPath, setTrackPath] = useState<L.LatLng[]>(() => {
    try {
      const stored = localStorage.getItem(TRACKING_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.map((p) => new L.LatLng(p.lat, p.lng));
        }
      }
    } catch (e) {
      console.error("Failed to parse stored track path", e);
    }
    return [];
  });
  const [currentPosition, setCurrentPosition] = useState<L.LatLng | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(TRACKING_STORAGE_KEY, JSON.stringify(trackPath));
    } catch (e) {
      console.error("Failed to save track path", e);
    }
  }, [trackPath]);

  useEffect(() => {
    let watchId: number;
    if (isTracking) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = new L.LatLng(pos.coords.latitude, pos.coords.longitude);
          setCurrentPosition(newPos);
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

  const clearTracking = useCallback(() => {
    setTrackPath([]);
    localStorage.removeItem(TRACKING_STORAGE_KEY);
  }, []);

  const exportGPX = useCallback(() => {
    if (trackPath.length === 0) {
      toast.error("No tracking data to export.");
      return;
    }

    const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Cymatic Resonance" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Map Tracking History</name>
    <trkseg>`;

    const gpxFooter = `
    </trkseg>
  </trk>
</gpx>`;

    const trkpts = trackPath
      .map((p) => `\n      <trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>`)
      .join("");

    const gpxContent = gpxHeader + trkpts + gpxFooter;
    const blob = new Blob([gpxContent], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `cymatic-tracking-${new Date().toISOString()}.gpx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("GPX file downloaded successfully.");
  }, [trackPath]);

  return { trackPath, currentPosition, clearTracking, exportGPX };
}
