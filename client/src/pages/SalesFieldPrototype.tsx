// ============================================================
// Sales Field — mobile-first CRM + route prototype
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ExternalLink,
  Loader2,
  Map as MapIcon,
  Route,
  Search,
  Star,
  List,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { MapView } from "@/components/Map";
import { OsmBrowseMap } from "@/components/OsmBrowseMap";
import { ResultsPanel } from "@/components/ResultsPanel";
import { RouteMap } from "@/components/RouteMap";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { RouteProvider, useRoute } from "@/contexts/RouteContext";
import { useIsMobile } from "@/hooks/useMobile";
import {
  filterLeads,
  formatMoney,
  leadToStopPayload,
  loadLeads,
  uniqueStates,
  type Lead,
  type LeadFilters,
} from "@/lib/leads";
import { hasGoogleMapsKey } from "@/lib/mapBackend";
import { cn } from "@/lib/utils";

function StarRow({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-0.5" aria-label={`${label} ${v} of 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={cn(
              "w-3 h-3",
              i < v ? "fill-amber-400 text-amber-500" : "text-muted-foreground/25"
            )}
          />
        ))}
      </div>
    </div>
  );
}

function browseMarkerIcon(highlighted: boolean): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: highlighted ? "#0d9488" : "#2563eb",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    scale: highlighted ? 9 : 7,
  };
}

type LeadsBrowseMapProps = {
  leads: Lead[];
  fitKey: string;
  highlightedId: string | null;
  onMarkerClick: (lead: Lead) => void;
};

function GoogleLeadsBrowseMap({
  leads,
  fitKey,
  highlightedId,
  onMarkerClick,
}: LeadsBrowseMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const lastFitKeyRef = useRef<string>("");

  const rebuildMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    markersRef.current.forEach((m) => {
      m.setMap(null);
    });
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    leads.forEach((lead) => {
      bounds.extend({ lat: lead.lat, lng: lead.lng });
      const marker = new google.maps.Marker({
        map,
        position: { lat: lead.lat, lng: lead.lng },
        title: lead.name,
        icon: browseMarkerIcon(lead.id === highlightedId),
      });
      marker.addListener("click", () => onMarkerClick(lead));
      markersRef.current.push(marker);
    });

    const shouldFit = lastFitKeyRef.current !== fitKey;
    if (!shouldFit) return;
    lastFitKeyRef.current = fitKey;

    if (leads.length === 0) {
      map.setCenter({ lat: 36.17, lng: -86.78 });
      map.setZoom(5);
    } else if (leads.length === 1) {
      map.setCenter({ lat: leads[0].lat, lng: leads[0].lng });
      map.setZoom(12);
    } else {
      map.fitBounds(bounds, { top: 56, right: 56, bottom: 56, left: 56 });
    }
  }, [leads, fitKey, highlightedId, onMarkerClick]);

  useEffect(() => {
    rebuildMarkers();
  }, [rebuildMarkers]);

  const handleReady = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      rebuildMarkers();
    },
    [rebuildMarkers]
  );

  return (
    <MapView
      className="w-full h-full min-h-[280px] md:min-h-0"
      initialCenter={{ lat: 36.17, lng: -86.78 }}
      initialZoom={6}
      mapId={null}
      onMapReady={handleReady}
    />
  );
}

function LeadsBrowseMap(props: LeadsBrowseMapProps) {
  if (hasGoogleMapsKey()) {
    return <GoogleLeadsBrowseMap {...props} />;
  }
  return (
    <OsmBrowseMap
      className="w-full h-full min-h-[280px] md:min-h-0"
      leads={props.leads.map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, name: l.name }))}
      fitKey={props.fitKey}
      highlightedId={props.highlightedId}
      onMarkerClick={(pin) => {
        const lead = props.leads.find((l) => l.id === pin.id);
        if (lead) props.onMarkerClick(lead);
      }}
    />
  );
}

function MapPinsRouteSegment({
  mapSubMode,
  onMapSubMode,
  leads,
  fitKey,
  highlightedId,
  onMarkerClick,
}: {
  mapSubMode: "pins" | "route";
  onMapSubMode: (m: "pins" | "route") => void;
  leads: Lead[];
  fitKey: string;
  highlightedId: string | null;
  onMarkerClick: (lead: Lead) => void;
}) {
  const { result } = useRoute();
  const routeOsmFitKey = result
    ? `route|${result.orderedStops.map((s) => s.id).join(",")}`
    : "";

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <div className="shrink-0 flex rounded-lg border border-border p-1 bg-muted/40 gap-1 mb-2">
        <button
          type="button"
          onClick={() => onMapSubMode("pins")}
          className={cn(
            "flex-1 min-h-9 rounded-md text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors",
            mapSubMode === "pins"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MapPin className="w-3.5 h-3.5" />
          Pins
        </button>
        <button
          type="button"
          onClick={() => onMapSubMode("route")}
          className={cn(
            "flex-1 min-h-9 rounded-md text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors",
            mapSubMode === "route"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Route className="w-3.5 h-3.5" />
          Route
        </button>
      </div>
      <div className="flex-1 min-h-0 relative rounded-xl overflow-hidden border border-border">
        {mapSubMode === "pins" ? (
          <LeadsBrowseMap
            leads={leads}
            fitKey={fitKey}
            highlightedId={highlightedId}
            onMarkerClick={onMarkerClick}
          />
        ) : result ? (
          hasGoogleMapsKey() ? (
            <RouteMap />
          ) : (
            <div className="absolute inset-0 flex flex-col min-h-0">
              <OsmBrowseMap
                className="flex-1 min-h-0 w-full rounded-none border-0"
                leads={result.orderedStops.map((s) => ({
                  id: s.id,
                  lat: s.lat,
                  lng: s.lng,
                  name: s.name,
                }))}
                fitKey={routeOsmFitKey}
                highlightedId={null}
                onMarkerClick={() => {}}
              />
              <p className="shrink-0 px-3 py-2 text-center text-xs text-muted-foreground bg-muted/40 border-t border-border">
                Route polyline requires Google Maps key
              </p>
            </div>
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground bg-muted/20">
            Optimise a route first
          </div>
        )}
      </div>
    </div>
  );
}

function SalesFieldInner() {
  const isMobile = useIsMobile();
  const {
    step,
    result,
    isOptimising,
    optimisingMessage,
    loadFromCSV,
    runOptimisation,
    resetToInput,
  } = useRoute();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState<string | null>(null);

  const [filters, setFilters] = useState<LeadFilters>({
    search: "",
    states: [],
  });
  const [statePopoverOpen, setStatePopoverOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [browseTab, setBrowseTab] = useState<"list" | "map">("list");
  const [mapSubMode, setMapSubMode] = useState<"pins" | "route">("pins");

  useEffect(() => {
    if (!result) setMapSubMode("pins");
  }, [result]);

  useEffect(() => {
    let cancelled = false;
    setLeadsLoading(true);
    setLeadsError(null);
    void loadLeads()
      .then((data) => {
        if (!cancelled) setLeads(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setLeadsError(e instanceof Error ? e.message : "Failed to load leads");
          setLeads([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLeadsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => filterLeads(leads, filters), [leads, filters]);

  const fitKey = useMemo(() => {
    const statesPart = [...filters.states].sort().join("|");
    return `${statesPart}|${filters.search.trim()}|${filtered.map((l) => l.id).join(",")}`;
  }, [filters.states, filters.search, filtered]);

  const stateOptions = useMemo(() => uniqueStates(leads), [leads]);

  const leadById = useMemo(() => {
    const m = new Map<string, Lead>();
    leads.forEach((l) => m.set(l.id, l));
    return m;
  }, [leads]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx >= 0) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const openDetail = useCallback((lead: Lead) => {
    setDetailLead(lead);
    setDrawerOpen(true);
  }, []);

  const handleOptimise = () => {
    if (!hasGoogleMapsKey()) {
      toast.info("Route optimisation needs a Google Maps API key. Browse map uses OpenStreetMap.");
      return;
    }
    const ordered = selectedIds
      .map((id) => leadById.get(id))
      .filter((l): l is Lead => Boolean(l));
    if (ordered.length < 2) return;
    loadFromCSV(ordered.map(leadToStopPayload));
    setTimeout(() => {
      void runOptimisation();
    }, 0);
  };

  const canOptimise = selectedIds.length >= 2 && !isOptimising;

  const resultsActive = step === "results" && result;

  if (resultsActive) {
    return (
      <div className="h-[100dvh] flex flex-col overflow-hidden bg-background">
        <header className="shrink-0 border-b border-border bg-sidebar text-sidebar-foreground px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
              <Route className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-tight truncate">Route result</h1>
              <p className="text-xs text-sidebar-foreground/60">Sales field</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={resetToInput}
            >
              Back to leads
            </Button>
            <a
              href={result.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Google Maps
            </a>
          </div>
        </header>

        <div
          className={cn(
            "flex-1 flex overflow-hidden min-h-0",
            isMobile ? "flex-col" : "flex-row"
          )}
        >
          <aside
            className={cn(
              "shrink-0 border-border bg-card overflow-hidden flex flex-col min-h-0",
              isMobile ? "w-full max-h-[46vh] border-b" : "w-full max-w-[400px] border-r"
            )}
          >
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              <ResultsPanel />
            </div>
          </aside>
          <main className="flex-1 relative min-h-[200px] overflow-hidden">
            <RouteMap />
          </main>
        </div>

        <div className="shrink-0 px-4 py-2 text-center border-t border-border bg-muted/20">
          <Link
            href="/optimizer"
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Open legacy route-only optimizer
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-background">
      <header className="shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Route className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">Sales field</h1>
            <p className="text-xs text-muted-foreground">Leads · route</p>
          </div>
        </div>
      </header>

      <div className="shrink-0 p-3 space-y-3 border-b border-border bg-muted/30">
        {leadsLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading leads…
          </div>
        )}
        {leadsError && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {leadsError}
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 min-h-11"
            placeholder="Search name, city, state…"
            value={filters.search}
            disabled={leadsLoading}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            States
          </p>
          <Popover open={statePopoverOpen} onOpenChange={setStatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={leadsLoading || leads.length === 0}
                className="w-full min-h-11 justify-between font-normal px-3"
              >
                <span className="truncate text-left">
                  {filters.states.length === 0
                    ? "All states"
                    : filters.states.length <= 2
                      ? filters.states.join(", ")
                      : `${filters.states.slice(0, 2).join(", ")} (+${filters.states.length - 2})`}
                </span>
                <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  onClick={() => setFilters((f) => ({ ...f, states: [] }))}
                >
                  Clear all
                </button>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  onClick={() => setFilters((f) => ({ ...f, states: [...stateOptions] }))}
                >
                  Select all
                </button>
              </div>
              <ScrollArea className="max-h-[240px]">
                <ul className="p-2 space-y-1">
                  {stateOptions.map((s) => {
                    const checked = filters.states.includes(s);
                    return (
                      <li key={s}>
                        <label className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60 cursor-pointer text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const on = v === true;
                              setFilters((f) => {
                                const next = new Set(f.states);
                                if (on) next.add(s);
                                else next.delete(s);
                                return { ...f, states: [...next].sort((a, b) => a.localeCompare(b)) };
                              });
                            }}
                          />
                          <span className="truncate">{s}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative">
        {isMobile ? (
          <Tabs
            value={browseTab}
            onValueChange={(v) => setBrowseTab(v as "list" | "map")}
            className="flex flex-col flex-1 min-h-0 gap-0"
          >
            <div className="shrink-0 px-3 pt-3">
              <TabsList className="w-full h-11 p-1 grid grid-cols-2">
                <TabsTrigger value="list" className="min-h-10 gap-2">
                  <List className="w-4 h-4" />
                  List
                </TabsTrigger>
                <TabsTrigger value="map" className="min-h-10 gap-2">
                  <MapIcon className="w-4 h-4" />
                  Map
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent
              value="list"
              className="flex-1 overflow-y-auto mt-0 px-3 pb-28 pt-3 min-h-0 data-[state=inactive]:hidden"
            >
              <LeadList
                leads={filtered}
                selectedIds={selectedIds}
                onToggle={toggleSelect}
                onOpenDetail={openDetail}
              />
            </TabsContent>
            <TabsContent
              value="map"
              className="flex-1 mt-0 px-3 pb-28 pt-3 min-h-0 relative data-[state=inactive]:hidden"
            >
              <div className="absolute inset-3 flex flex-col min-h-0">
                <MapPinsRouteSegment
                  mapSubMode={mapSubMode}
                  onMapSubMode={setMapSubMode}
                  leads={filtered}
                  fitKey={fitKey}
                  highlightedId={detailLead?.id ?? null}
                  onMarkerClick={openDetail}
                />
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex flex-1 min-h-0 flex-row">
            <div className="w-full max-w-md shrink-0 border-r border-border overflow-y-auto p-4 pb-28 min-h-0">
              <LeadList
                leads={filtered}
                selectedIds={selectedIds}
                onToggle={toggleSelect}
                onOpenDetail={openDetail}
              />
            </div>
            <div className="flex-1 relative min-h-0 p-4 pb-28">
              <div className="absolute inset-4 flex flex-col min-h-0">
                <MapPinsRouteSegment
                  mapSubMode={mapSubMode}
                  onMapSubMode={setMapSubMode}
                  leads={filtered}
                  fitKey={fitKey}
                  highlightedId={detailLead?.id ?? null}
                  onMarkerClick={openDetail}
                />
              </div>
            </div>
          </div>
        )}

        <AnimatePresence>
          {isOptimising && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-30"
            >
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
              <p className="text-sm font-semibold">{optimisingMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground shrink-0">
              <span className="font-mono font-semibold text-foreground">{selectedIds.length}</span>{" "}
              selected
            </p>
            <Button
              className="min-h-11 px-6 font-semibold"
              disabled={!canOptimise}
              onClick={handleOptimise}
            >
              Optimise route
            </Button>
          </div>
        </div>
      </div>

      <div className="shrink-0 px-4 py-2 text-center border-t border-border bg-muted/20">
        <Link
          href="/optimizer"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Open legacy route-only optimizer
        </Link>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          {detailLead && (
            <>
              <DrawerHeader className="text-left">
                <DrawerTitle className="text-base leading-snug">{detailLead.name}</DrawerTitle>
                <DrawerDescription>
                  {detailLead.city}, {detailLead.state}
                </DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-6 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Total sales
                  </p>
                  <p className="text-2xl font-mono font-bold tracking-tight">
                    {formatMoney(detailLead.totalSales)}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Last order
                    </p>
                    <p className="font-mono">{detailLead.lastOrder}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Last order summary
                    </p>
                    <p className="leading-snug">{detailLead.lastOrderSummary}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Last order amount
                    </p>
                    <p className="font-mono">
                      {formatMoney(detailLead.lastOrderAmount, "USD", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Open balance
                    </p>
                    <p className="font-mono">
                      {formatMoney(detailLead.openBalance, "USD", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                    Rating
                  </p>
                  <StarRow label="Score" value={detailLead.ratingScore} />
                </div>
                <Button
                  className="w-full min-h-11"
                  variant={selectedIds.includes(detailLead.id) ? "secondary" : "default"}
                  onClick={() => {
                    toggleSelect(detailLead.id);
                  }}
                >
                  {selectedIds.includes(detailLead.id) ? "Remove from route" : "Add to route"}
                </Button>
              </div>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function LeadList({
  leads,
  selectedIds,
  onToggle,
  onOpenDetail,
}: {
  leads: Lead[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onOpenDetail: (lead: Lead) => void;
}) {
  return (
    <ul className="space-y-3">
      {leads.map((lead) => {
        const sel = selectedIds.indexOf(lead.id);
        const selected = sel >= 0;
        return (
          <li key={lead.id}>
            <button
              type="button"
              onClick={() => onOpenDetail(lead)}
              className={cn(
                "w-full text-left rounded-xl border p-4 transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-secondary/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {selected && (
                      <span className="inline-flex items-center justify-center min-w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-mono font-bold">
                        {sel + 1}
                      </span>
                    )}
                    <span className="font-semibold text-sm leading-tight">{lead.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lead.city}, {lead.state}
                  </p>
                  <p className="text-lg font-mono font-bold tracking-tight mt-2">
                    {formatMoney(lead.totalSales)}
                  </p>
                  <div className="mt-2">
                    <StarRow label="Rating" value={lead.ratingScore} />
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={selected ? "secondary" : "outline"}
                  className="min-h-11 flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(lead.id);
                  }}
                >
                  {selected ? "Deselect" : "Select"}
                </Button>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function SalesFieldPrototype() {
  return (
    <RouteProvider>
      <SalesFieldInner />
    </RouteProvider>
  );
}
