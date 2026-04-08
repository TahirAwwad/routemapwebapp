import { useEffect, useState } from "react";

export interface DriverLocation {
  lat: number;
  lng: number;
  accuracyMeters?: number;
  updatedAtMs: number;
}

export function useDriverLocation(enabled = true) {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          updatedAtMs: pos.timestamp,
        });
        setError(null);
      },
      (err) => {
        setError(err.message || "Unable to fetch GPS location");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled]);

  return { location, error };
}
