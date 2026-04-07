import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface OsmBrowseMapLead {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

export interface OsmBrowseMapProps {
  leads: OsmBrowseMapLead[];
  fitKey: string;
  highlightedId: string | null;
  onMarkerClick: (lead: OsmBrowseMapLead) => void;
  className?: string;
}

const DEFAULT_CENTER: L.LatLngExpression = [36.17, -86.78];
const DEFAULT_ZOOM = 5;

export function OsmBrowseMap({
  leads,
  fitKey,
  highlightedId,
  onMarkerClick,
  className,
}: OsmBrowseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const lastFitKeyRef = useRef<string>("");
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = L.map(el, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const layer = L.layerGroup().addTo(map);
    markersLayerRef.current = layer;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      lastFitKeyRef.current = "";
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    let bounds: L.LatLngBounds | undefined;

    for (const lead of leads) {
      const isHi = lead.id === highlightedId;
      const ll = L.latLng(lead.lat, lead.lng);
      const cm = L.circleMarker(ll, {
        radius: isHi ? 9 : 7,
        fillColor: isHi ? "#0d9488" : "#2563eb",
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 1,
      });
      cm.bindTooltip(lead.name);
      cm.on("click", () => {
        onMarkerClickRef.current(lead);
      });
      cm.addTo(layer);
      bounds = bounds ? bounds.extend(ll) : L.latLngBounds(ll, ll);
    }

    const shouldFit = lastFitKeyRef.current !== fitKey;
    if (!shouldFit) return;
    lastFitKeyRef.current = fitKey;

    if (leads.length === 0) {
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    } else if (leads.length === 1) {
      map.setView([leads[0].lat, leads[0].lng], 12);
    } else if (bounds?.isValid()) {
      map.fitBounds(bounds, { padding: [56, 56] });
    }
  }, [leads, fitKey, highlightedId]);

  return <div ref={containerRef} className={cn("w-full h-full min-h-[280px]", className)} />;
}
