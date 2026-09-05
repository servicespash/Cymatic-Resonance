export interface LatLngPoint {
  lat: number;
  lng: number;
}

/**
 * Default fallback coordinates if geolocation is denied, unavailable, or coordinates are invalid.
 * Default reference: Kampala Base Station (0.3476, 32.5825) with 200m perimeter.
 */
export const DEFAULT_FALLBACK_LOCATION: LatLngPoint & { radius: number } = {
  lat: 0.3476,
  lng: 32.5825,
  radius: 200,
};

/**
 * Validates if coordinates are finite, non-NaN, and within standard geographic bounds (-90..90, -180..180).
 */
export function isValidLatLng(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const nLat = typeof lat === "number" ? lat : parseFloat(String(lat));
  const nLng = typeof lng === "number" ? lng : parseFloat(String(lng));

  return (
    !isNaN(nLat) &&
    !isNaN(nLng) &&
    isFinite(nLat) &&
    isFinite(nLng) &&
    Math.abs(nLat) <= 90 &&
    Math.abs(nLng) <= 180
  );
}

/**
 * Safe coordinate validation layer. Ensures coordinates are numbers and never NaN.
 * If invalid, returns the fallback coordinates.
 */
export function safeCoordinates(
  lat: number | string | null | undefined,
  lng: number | string | null | undefined,
  fallback: LatLngPoint = DEFAULT_FALLBACK_LOCATION,
): LatLngPoint & { isValid: boolean } {
  if (isValidLatLng(lat, lng)) {
    return {
      lat: typeof lat === "number" ? lat : parseFloat(String(lat)),
      lng: typeof lng === "number" ? lng : parseFloat(String(lng)),
      isValid: true,
    };
  }
  return {
    lat: fallback.lat,
    lng: fallback.lng,
    isValid: false,
  };
}

/**
 * Calculates the distance between two coordinate points in meters using the Haversine formula.
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (
    !isValidLatLng(lat1, lon1) ||
    !isValidLatLng(lat2, lon2) ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return 0;
  }

  const R = 6371e3; // Earth's radius in meters
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return isNaN(distance) || !isFinite(distance) ? 0 : distance;
}

/**
 * Helper function to calculate distance in meters between user checked-in coordinates and a reference point.
 */
export function calculateCoordinatesDistance(
  userCoords: { lat?: number | null; lng?: number | null } | null | undefined,
  referencePoint: { lat?: number | null; lng?: number | null } | null | undefined,
): number {
  if (!userCoords || !referencePoint) return 0;
  if (!isValidLatLng(userCoords.lat, userCoords.lng)) return 0;
  if (!isValidLatLng(referencePoint.lat, referencePoint.lng)) return 0;

  return getDistance(
    Number(userCoords.lat),
    Number(userCoords.lng),
    Number(referencePoint.lat),
    Number(referencePoint.lng),
  );
}

/**
 * Formats distance in a human-readable format (e.g., "45m", "1.25km", "At station").
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters === null || meters === undefined || isNaN(meters) || !isFinite(meters) || meters < 0) {
    return "Unknown distance";
  }
  if (meters < 10) return "Within zone (<10m)";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(2)}km`;
}
