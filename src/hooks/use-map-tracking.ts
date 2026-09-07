import { useState, useEffect, useCallback } from "react";
import L from "leaflet";
import { toast } from "sonner";

export function useMapTracking(isTracking: boolean) {
  const [trackPath, setTrackPath] = useState<L.LatLng[]>([]);
  const [currentPosition, setCurrentPosition] = useState<L.LatLng | null>(null);

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
    } else {
      setTrackPath([]);
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isTracking]);

  return { trackPath, currentPosition };
}
