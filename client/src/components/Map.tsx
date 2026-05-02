/**
 * GOOGLE MAPS FRONTEND INTEGRATION - ESSENTIAL GUIDE
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 *
 * const mapRef = useRef<google.maps.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => {
 *     mapRef.current = map; // Store to control map from parent anytime, google map itself is in charge of the re-rendering, not react state.
 * </MapView>
 *
 * ======
 * Available Libraries and Core Features:
 * -------------------------------
 * 📍 MARKER (from `marker` library)
 * - Attaches to map using { map, position }
 * new google.maps.marker.AdvancedMarkerElement({
 *   map,
 *   position: { lat: 37.7749, lng: -122.4194 },
 *   title: "San Francisco",
 * });
 *
 * -------------------------------
 * 🏢 PLACES (from `places` library)
 * - Does not attach directly to map; use data with your map manually.
 * const place = new google.maps.places.Place({ id: PLACE_ID });
 * await place.fetchFields({ fields: ["displayName", "location"] });
 * map.setCenter(place.location);
 * new google.maps.marker.AdvancedMarkerElement({ map, position: place.location });
 *
 * -------------------------------
 * 🧭 GEOCODER (from `geocoding` library)
 * - Standalone service; manually apply results to map.
 * const geocoder = new google.maps.Geocoder();
 * geocoder.geocode({ address: "New York" }, (results, status) => {
 *   if (status === "OK" && results[0]) {
 *     map.setCenter(results[0].geometry.location);
 *     new google.maps.marker.AdvancedMarkerElement({
 *       map,
 *       position: results[0].geometry.location,
 *     });
 *   }
 * });
 *
 * -------------------------------
 * 📐 GEOMETRY (from `geometry` library)
 * - Pure utility functions; not attached to map.
 * const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
 *
 * -------------------------------
 * 🛣️ ROUTES (from `routes` library)
 * - Combines DirectionsService (standalone) + DirectionsRenderer (map-attached)
 * const directionsService = new google.maps.DirectionsService();
 * const directionsRenderer = new google.maps.DirectionsRenderer({ map });
 * directionsService.route(
 *   { origin, destination, travelMode: "DRIVING" },
 *   (res, status) => status === "OK" && directionsRenderer.setDirections(res)
 * );
 *
 * -------------------------------
 * 🌦️ MAP LAYERS (attach directly to map)
 * - new google.maps.TrafficLayer().setMap(map);
 * - new google.maps.TransitLayer().setMap(map);
 * - new google.maps.BicyclingLayer().setMap(map);
 *
 * -------------------------------
 * ✅ SUMMARY
 * - “map-attached” → AdvancedMarkerElement, DirectionsRenderer, Layers.
 * - “standalone” → Geocoder, DirectionsService, DistanceMatrixService, ElevationService.
 * - “data-only” → Place, Geometry utilities.
 */

/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { MAPS_FORGE_KEY, MAPS_GOOGLE_KEY, hasGoogleMapsKey } from "@/lib/mapBackend";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
  }
}

const FALLBACK_GOOGLE_MAPS_API_KEY = 'AIzaSyBJ5gEWzKhFl6SG9TWr1w07kOXZc1lZY';

const FORGE_KEY = MAPS_FORGE_KEY;
const GOOGLE_KEY = MAPS_GOOGLE_KEY;

const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

const MAP_LIBRARIES = "marker,places,geocoding,geometry";

// Singleton promise so the script is only ever injected once per page load
let _mapsLoadPromise: Promise<void> | null = null;
let _loadedScriptSrc: string | null = null;

function scriptSrcForCurrentKeys(): string | null {
  if (FORGE_KEY) {
    return `${MAPS_PROXY_URL}/maps/api/js?key=${encodeURIComponent(FORGE_KEY)}&v=weekly&libraries=${MAP_LIBRARIES}`;
  }
  if (GOOGLE_KEY || FALLBACK_GOOGLE_MAPS_API_KEY) {
    const apiKey = GOOGLE_KEY || FALLBACK_GOOGLE_MAPS_API_KEY;
    return `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=${MAP_LIBRARIES}&callback=initMap`;
  }
  return null;
}

function loadMapScript(): Promise<void> {
  const src = scriptSrcForCurrentKeys();
  if (!src) {
    return Promise.reject(new Error("No Google Maps API key configured"));
  }

  if (window.google?.maps) return Promise.resolve();

  if (_mapsLoadPromise && _loadedScriptSrc === src) return _mapsLoadPromise;

  _mapsLoadPromise = new Promise((resolve, reject) => {
    _loadedScriptSrc = src;

    let existing: HTMLScriptElement | null = null;
    const want = new URL(src, document.baseURI).href;
    for (const el of Array.from(document.getElementsByTagName("script"))) {
      try {
        if (el.src && new URL(el.src).href === want) {
          existing = el;
          break;
        }
      } catch {
        /* ignore */
      }
    }
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps script")));
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });

  return _mapsLoadPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
  /** Only applied when a non-empty string (omit for classic `google.maps.Marker` maps). */
  mapId?: string | null;
  /** Shown when no API key is configured */
  missingKeyMessage?: string;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
  mapId,
  missingKeyMessage = "Add VITE_FRONTEND_FORGE_API_KEY or VITE_GOOGLE_MAPS_API_KEY to show the map.",
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const hasKey = hasGoogleMapsKey();

  const init = usePersistFn(async () => {
    if (!hasKey) {
      console.error(
        "MapView: No maps API key. Set VITE_FRONTEND_FORGE_API_KEY or VITE_GOOGLE_MAPS_API_KEY."
      );
      setLoadError("missing-key");
      return;
    }

    try {
      await loadMapScript();
    } catch (e) {
      console.error("MapView: failed to load Google Maps script", e);
      setLoadError("load-failed");
      return;
    }

    if (!mapContainer.current) {
      console.error("Map container not found");
      return;
    }

    const options: google.maps.MapOptions = {
      zoom: initialZoom,
      center: initialCenter,
      mapTypeControl: true,
      fullscreenControl: true,
      zoomControl: true,
      streetViewControl: true,
    };

    if (typeof mapId === "string" && mapId.length > 0) {
      options.mapId = mapId;
    }

    map.current = new window.google!.maps.Map(mapContainer.current, options);
    onMapReady?.(map.current);
  });

  useEffect(() => {
    void init();
  }, [init]);

  if (!hasKey) {
    return (
      <div
        className={cn(
          "w-full h-[500px] flex items-center justify-center text-center text-sm text-muted-foreground px-4 bg-muted/30 border border-border rounded-md",
          className
        )}
      >
        {missingKeyMessage}
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className={cn(
          "w-full h-[500px] flex items-center justify-center text-center text-sm text-destructive px-4 bg-muted/30 border border-border rounded-md",
          className
        )}
      >
        {loadError === "load-failed"
          ? "Could not load Google Maps. Check your network and API key."
          : missingKeyMessage}
      </div>
    );
  }

  return (
    <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />
  );
}
