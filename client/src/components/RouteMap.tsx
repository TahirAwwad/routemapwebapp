// ============================================================
// RouteMap — Google Maps view with:
//  - Light/minimal map style (locked, no toggle)
//  - Segment-coloured markers (one colour per route segment)
//  - One coloured polyline per segment
//  - Click highlight with rank tooltip (no zoom on hover)
// ============================================================

import { useEffect, useRef, useCallback, useState } from "react";
import { MapView } from "@/components/Map";
import { useRoute } from "@/contexts/RouteContext";
import { getSegmentColor, buildStopSegmentMap, ORIGIN_COLOR, DESTINATION_COLOR } from "@/lib/clustering";
import type { Stop } from "@/lib/types";
import { cn } from "@/lib/utils";


// Light/minimal Google Maps style
const LIGHT_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
];



interface TooltipInfo {
  stopId: string;
  rank: number;
  total: number;
  name: string;
  address: string;
  segmentLabel: string;
  segmentColorHex: string;
  x: number;
  y: number;
}

export function RouteMap({
  driverLocation,
}: {
  driverLocation?: { lat: number; lng: number } | null;
} = {}) {
  const { stops, result, mapRef, hoveredStopId, setHoveredStopId, selectedSegment } = useRoute();
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  // Multiple renderers — one per segment
  const renderersRef = useRef<google.maps.DirectionsRenderer[]>([]);
  const mapReadyRef = useRef(false);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Build per-stop segment index map
  const allStops = result ? result.orderedStops : stops;
  // Filter stops by selected segment
  const segMap = result ? buildStopSegmentMap(result.segments) : allStops.map(() => 0);
  const currentStops = (result && selectedSegment !== "all")
    ? allStops.filter((_, i) => segMap[i] === selectedSegment)
    : allStops;
  const stopSegmentMap = segMap;

  const clearRenderers = useCallback(() => {
    renderersRef.current.forEach((r) => r.setMap(null));
    renderersRef.current = [];
  }, []);

  const renderStops = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;

    // Clear existing markers
    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setMap(null);
      driverMarkerRef.current = null;
    }

    // Clear existing renderers
    clearRenderers();

    if (currentStops.length === 0) return;

    const segMap = result ? buildStopSegmentMap(result.segments) : allStops.map(() => 0);
    const bounds = new google.maps.LatLngBounds();
    const totalStops = currentStops.length;

    currentStops.forEach((stop, i) => {
      const position = { lat: stop.lat, lng: stop.lng };
      bounds.extend(position);

      const segIdx = segMap[i] ?? 0;
      const color =
        stop.role === "origin"
          ? ORIGIN_COLOR
          : stop.role === "destination"
          ? DESTINATION_COLOR
          : getSegmentColor(segIdx);

      const isHovered = stop.id === hoveredStopId;
      const pinEl = buildMarkerElement(stop, i + 1, color.hex, isHovered);

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        title: stop.name,
        content: pinEl,
      });

      const segLabel = result?.segments[segIdx]?.label ?? "Route";
      const segColorHex = getSegmentColor(segIdx).hex;

      marker.addListener("click", () => {
        if (hoveredStopId === stop.id) {
          setHoveredStopId(null);
          setTooltip(null);
        } else {
          setHoveredStopId(stop.id);
          showTooltipForStop(stop, i, totalStops, segLabel, segColorHex);
        }
      });

      markersRef.current.push(marker);
    });
    if (driverLocation) {
      driverMarkerRef.current = new google.maps.Marker({
        map,
        position: { lat: driverLocation.lat, lng: driverLocation.lng },
        title: "Driver location",
        zIndex: 1000,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#111827",
          fillOpacity: 1,
          strokeColor: "#67e8f9",
          strokeWeight: 5,
          scale: 8,
        },
      });
      bounds.extend({ lat: driverLocation.lat, lng: driverLocation.lng });
    }

    // Fit bounds
    if (currentStops.length === 1) {
      map.setCenter({ lat: currentStops[0].lat, lng: currentStops[0].lng });
      map.setZoom(13);
    } else {
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }

    // Draw one polyline per segment (filtered by selectedSegment)
    if (result && result.segments.length > 0) {
      result.segments.forEach((seg, si) => {
        if (seg.orderedStops.length < 2) return;
        if (selectedSegment !== "all" && si !== selectedSegment) return;
        renderSegmentPolyline(map, seg.orderedStops, si);
      });
    }
  }, [stops, result, mapRef, hoveredStopId, setHoveredStopId, clearRenderers, selectedSegment, allStops, driverLocation]); // eslint-disable-line

  function showTooltipForStop(
    stop: Stop,
    index: number,
    total: number,
    segmentLabel: string,
    segmentColorHex: string
  ) {
    const map = mapRef.current;
    if (!map || !mapContainerRef.current) return;

    const projection = map.getProjection();
    if (!projection) return;

    const latLng = new google.maps.LatLng(stop.lat, stop.lng);
    const worldPoint = projection.fromLatLngToPoint(latLng);
    if (!worldPoint) return;

    const zoom = map.getZoom() ?? 10;
    const scale = Math.pow(2, zoom);
    const mapDiv = map.getDiv();
    const mapBounds = mapDiv.getBoundingClientRect();
    const containerBounds = mapContainerRef.current.getBoundingClientRect();

    const centerLatLng = map.getCenter();
    if (!centerLatLng) return;
    const centerPoint = projection.fromLatLngToPoint(centerLatLng);
    if (!centerPoint) return;

    const x = (worldPoint.x - centerPoint.x) * scale + mapBounds.width / 2 + (mapBounds.left - containerBounds.left);
    const y = (worldPoint.y - centerPoint.y) * scale + mapBounds.height / 2 + (mapBounds.top - containerBounds.top);

    setTooltip({
      stopId: stop.id,
      rank: index + 1,
      total,
      name: stop.name,
      address: stop.address || "",
      segmentLabel,
      segmentColorHex,
      x,
      y,
    });
  }

  function renderSegmentPolyline(
    map: google.maps.Map,
    orderedStops: Stop[],
    segmentIndex: number
  ) {
    const color = getSegmentColor(segmentIndex);

    const renderer = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: color.hex,
        strokeWeight: 5,
        strokeOpacity: 0.88,
        zIndex: 10 + segmentIndex,
      },
    });
    renderersRef.current.push(renderer);

    const service = new google.maps.DirectionsService();
    const origin = orderedStops[0];
    const destination = orderedStops[orderedStops.length - 1];
    const waypoints = orderedStops.slice(1, -1).slice(0, 23).map((s) => ({
      location: new google.maps.LatLng(s.lat, s.lng),
      stopover: true,
    }));

    service.route(
      {
        origin: new google.maps.LatLng(origin.lat, origin.lng),
        destination: new google.maps.LatLng(destination.lat, destination.lng),
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (res, status) => {
        if (status === "OK" && res) {
          // Find the renderer for this segment (it may have been cleared)
          const idx = renderersRef.current.indexOf(renderer);
          if (idx !== -1) {
            renderer.setDirections(res);
          }
        }
      }
    );
  }

  // Re-render whenever stops or result change
  useEffect(() => {
    if (mapReadyRef.current) {
      renderStops();
    }
  }, [renderStops]);

  // Update marker highlight when hoveredStopId changes (without full re-render)
  useEffect(() => {
    const segMap = result ? buildStopSegmentMap(result.segments) : allStops.map(() => 0);

    markersRef.current.forEach((marker, i) => {
      const stop = currentStops[i];
      if (!stop) return;
      const segIdx = segMap[i] ?? 0;
      const color =
        stop.role === "origin"
          ? ORIGIN_COLOR
          : stop.role === "destination"
          ? DESTINATION_COLOR
          : getSegmentColor(segIdx);
      const isHovered = stop.id === hoveredStopId;
      marker.content = buildMarkerElement(stop, i + 1, color.hex, isHovered);
    });
  }, [hoveredStopId, stops, result, selectedSegment]);



  function handleMapReady(map: google.maps.Map) {
    mapRef.current = map;
    mapReadyRef.current = true;
    map.setOptions({
      styles: LIGHT_MAP_STYLE,
      mapTypeControl: false,
      streetViewControl: false,
    });
    renderStops();
  }

  return (
    <div ref={mapContainerRef} className="relative w-full h-full">
      <MapView
        className="w-full h-full min-h-[300px]"
        initialCenter={{ lat: 36.17, lng: -86.78 }}
        initialZoom={9}
        mapId="DEMO_MAP_ID"
        onMapReady={handleMapReady}
      />


      {/* Segment legend — shown when multi-segment results are active */}
      {result && result.segments.length > 1 && (
        <div className="absolute bottom-8 left-3 z-10 bg-white/95 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 px-3 py-2 space-y-1">
          {result.segments.map((seg, si) => {
            const c = getSegmentColor(si);
            return (
              <div key={si} className="flex items-center gap-2">
                <div
                  className="w-4 h-1.5 rounded-full"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-xs text-gray-700 font-medium">{seg.label}</span>
                <span className="text-xs text-gray-400">{seg.orderedStops.length} stops</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 110,
            transform: "translateX(-50%)",
          }}
        >
          <div className="bg-white border border-gray-200 rounded-lg shadow-xl px-3 py-2.5 min-w-[180px] max-w-[260px]">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold text-white"
                style={{ backgroundColor: tooltip.segmentColorHex }}
              >
                Stop {tooltip.rank} of {tooltip.total}
              </span>
              {result && result.segments.length > 1 && (
                <span className="text-xs text-gray-400">{tooltip.segmentLabel}</span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">
              {tooltip.name}
            </p>
            {tooltip.address && tooltip.address !== tooltip.name && (
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                {tooltip.address}
              </p>
            )}
          </div>
          <div className="flex justify-center">
            <div className="w-2.5 h-2.5 bg-white border-r border-b border-gray-200 rotate-45 -mt-1.5" />
          </div>
        </div>
      )}
    </div>
  );
}

function ViewToggleButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function buildMarkerElement(
  stop: Stop,
  rank: number,
  colorHex: string,
  isHovered: boolean
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = `
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    z-index: ${isHovered ? 100 : 1};
  `;

  const pin = document.createElement("div");
  pin.style.cssText = `
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: ${colorHex};
    border: ${isHovered ? "3px" : "2px"} solid white;
    box-shadow: ${isHovered ? "0 4px 12px rgba(0,0,0,0.45)" : "0 2px 6px rgba(0,0,0,0.3)"};
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const label = document.createElement("span");
  label.style.cssText = `
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    color: white;
    line-height: 1;
    user-select: none;
  `;
  label.textContent = String(rank);

  pin.appendChild(label);
  wrapper.appendChild(pin);

  // Tail for origin/destination
  if (stop.role === "origin" || stop.role === "destination") {
    const tail = document.createElement("div");
    tail.style.cssText = `
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 7px solid ${colorHex};
      margin-top: -1px;
    `;
    wrapper.appendChild(tail);
  }

  return wrapper;
}
