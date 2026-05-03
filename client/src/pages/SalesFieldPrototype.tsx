// ============================================================
// Sales Field — mobile-first CRM + route prototype
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Map as MapIcon,
  RefreshCw,
  Route,
  Search,
  List,
  MapPin,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { MapView } from "@/components/Map";
import { OsmBrowseMap } from "@/components/OsmBrowseMap";
import { ResultsPanel } from "@/components/ResultsPanel";
import { RouteMap } from "@/components/RouteMap";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { RouteProvider, useRoute } from "@/contexts/RouteContext";
import { useDriverLocation } from "@/hooks/useDriverLocation";
import { useIsMobile } from "@/hooks/useMobile";
import {
  filterLeads,
  formatMoney,
  leadGoogleMapsUrl,
  leadToStopPayload,
  loadLeads,
  uniqueCities,
  uniqueStates,
  type Lead,
  type LeadFilters,
} from "@/lib/leads";
import { hasGoogleMapsKey } from "@/lib/mapBackend";
import { getSearchSuggestions, type SearchSuggestion } from "@/lib/searchSuggest";
import { cn } from "@/lib/utils";

function LocationMultiSelect({
  label,
  allSummary,
  options,
  selected,
  onSelectedChange,
  disabled,
}: {
  label: string;
  allSummary: string;
  options: string[];
  selected: string[];
  onSelectedChange: (next: string[]) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const summary =
    selected.length === 0
      ? allSummary
      : selected.length <= 2
        ? selected.join(", ")
        : `${selected.slice(0, 2).join(", ")} (+${selected.length - 2})`;

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || options.length === 0}
            className="w-full min-h-11 justify-between font-normal px-3"
          >
            <span className="truncate text-left">{summary}</span>
            <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          collisionPadding={12}
          className={cn(
            "p-0 min-w-0 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md z-[100]",
            "w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-1.5rem,var(--radix-popover-trigger-width))]"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border shrink-0">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              onClick={() => onSelectedChange([])}
            >
              Clear all
            </button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              onClick={() => onSelectedChange([...options])}
            >
              Select all
            </button>
          </div>
          <div className="max-h-[min(240px,45vh)] overflow-y-auto overflow-x-hidden overscroll-contain">
            <ul className="p-2 space-y-0.5 w-full min-w-0">
              {options.map((opt) => {
                const checked = selected.includes(opt);
                return (
                  <li key={opt} className="min-w-0">
                    <label className="flex items-center gap-2 rounded-md px-2 py-2 min-h-11 hover:bg-muted/60 cursor-pointer text-sm min-w-0">
                      <Checkbox
                        checked={checked}
                        className="shrink-0"
                        onCheckedChange={(v) => {
                          const on = v === true;
                          const next = new Set(selected);
                          if (on) next.add(opt);
                          else next.delete(opt);
                          onSelectedChange(Array.from(next).sort((a, b) => a.localeCompare(b)));
                        }}
                      />
                      <span className="truncate min-w-0 flex-1 text-left">{opt}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function LeadSearchField({
  value,
  disabled,
  leads,
  onChange,
}: {
  value: string;
  disabled: boolean;
  leads: Lead[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    };
  }, []);

  const suggestions = useMemo(
    () => getSearchSuggestions(value, leads, 10),
    [value, leads]
  );

  const showList = open && !disabled && value.trim().length > 0 && suggestions.length > 0;

  const clearBlurTimer = () => {
    if (blurTimer.current) {
      clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  };

  const pick = (s: SearchSuggestion) => {
    onChange(s.applyText);
    setOpen(false);
    setHighlight(0);
  };

  return (
    <div ref={wrapRef} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        aria-controls="lead-search-suggestions"
        className="pl-9 min-h-11"
        placeholder="Search client name or code…"
        autoComplete="off"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          clearBlurTimer();
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 180);
        }}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((i) => Math.min(i + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(suggestions[highlight] ?? suggestions[0]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul
          id="lead-search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-56 overflow-y-auto overflow-x-hidden rounded-md border border-border bg-popover py-1 shadow-md"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.display}-${i}`} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                className={cn(
                  "w-full px-3 py-2.5 text-left text-sm min-h-11 hover:bg-muted/80 transition-colors truncate",
                  i === highlight && "bg-muted"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => pick(s)}
              >
                {s.display}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function browseMarkerIcon(highlighted: boolean): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: highlighted ? "#0f766e" : "#1d4ed8",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 4,
    scale: highlighted ? 12 : 10,
  };
}

type LeadsBrowseMapProps = {
  leads: Lead[];
  fitKey: string;
  highlightedId: string | null;
  driverLocation: { lat: number; lng: number } | null;
  onMarkerClick: (lead: Lead) => void;
};

function GoogleLeadsBrowseMap({
  leads,
  fitKey,
  highlightedId,
  driverLocation,
  onMarkerClick,
}: LeadsBrowseMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const lastFitKeyRef = useRef<string>("");

  const rebuildMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    markersRef.current.forEach((m) => {
      m.setMap(null);
    });
    markersRef.current = [];
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setMap(null);
      driverMarkerRef.current = null;
    }

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
    if (driverLocation) {
      driverMarkerRef.current = new google.maps.Marker({
        map,
        position: { lat: driverLocation.lat, lng: driverLocation.lng },
        title: "Driver location",
        zIndex: 999,
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
  }, [leads, fitKey, highlightedId, driverLocation, onMarkerClick]);

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
      driverLocation={props.driverLocation}
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
  driverLocation,
  onMarkerClick,
}: {
  mapSubMode: "pins" | "route";
  onMapSubMode: (m: "pins" | "route") => void;
  leads: Lead[];
  fitKey: string;
  highlightedId: string | null;
  driverLocation: { lat: number; lng: number } | null;
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
            driverLocation={driverLocation}
            onMarkerClick={onMarkerClick}
          />
        ) : result ? (
          hasGoogleMapsKey() ? (
            <RouteMap driverLocation={driverLocation} />
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
                driverLocation={driverLocation}
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
    cities: [],
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visitedIds, setVisitedIds] = useState<string[]>([]);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [browseTab, setBrowseTab] = useState<"list" | "map">("list");
  const [mapSubMode, setMapSubMode] = useState<"pins" | "route">("pins");
  const { location: driverLocation } = useDriverLocation(true);

  useEffect(() => {
    if (!result) setMapSubMode("pins");
  }, [result]);

  const reloadLeads = useCallback(async (opts?: { silent?: boolean }) => {
    setLeadsLoading(true);
    setLeadsError(null);
    try {
      const data = await loadLeads();
      setLeads(data);
      if (!opts?.silent) toast.success(`Synced ${data.length} leads`);
    } catch (e) {
      setLeadsError(e instanceof Error ? e.message : "Failed to load leads");
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadLeads({ silent: true });
  }, [reloadLeads]);

  const filtered = useMemo(() => filterLeads(leads, filters), [leads, filters]);

  const fitKey = useMemo(() => {
    const statesPart = [...filters.states].sort().join("|");
    const citiesPart = [...filters.cities].sort().join("|");
    return `${statesPart}|${citiesPart}|${filters.search.trim()}|${filtered.map((l) => l.id).join(",")}`;
  }, [filters.states, filters.cities, filters.search, filtered]);

  const stateOptions = useMemo(() => uniqueStates(leads), [leads]);
  const cityOptions = useMemo(() => uniqueCities(leads, filters.states), [leads, filters.states]);

  useEffect(() => {
    const allowed = new Set(cityOptions);
    setFilters((f) => {
      if (f.cities.length === 0) return f;
      const next = f.cities.filter((c) => allowed.has(c.trim()));
      if (next.length === f.cities.length) return f;
      return { ...f, cities: next };
    });
  }, [cityOptions]);

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

  const removeFromSelection = useCallback((id: string) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const markVisited = useCallback((id: string) => {
    setVisitedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const selectAllFiltered = useCallback(() => {
    const ids = filtered.map((l) => l.id).filter((id) => !visitedIds.includes(id));
    setSelectedIds(ids);
  }, [filtered, visitedIds]);

  const openDetail = useCallback((lead: Lead) => {
    setDetailLead(lead);
    setDrawerOpen(true);
  }, []);

  const activeSelectedIds = useMemo(
    () => selectedIds.filter((id) => !visitedIds.includes(id)),
    [selectedIds, visitedIds]
  );

  const handleOptimise = () => {
    if (!hasGoogleMapsKey()) {
      toast.info("Route optimisation needs a Google Maps API key. Browse map uses OpenStreetMap.");
      return;
    }
    const ordered = activeSelectedIds
      .map((id) => leadById.get(id))
      .filter((l): l is Lead => Boolean(l));
    if (ordered.length < 2) {
      toast.info("Select at least 2 non-visited leads.");
      return;
    }
    loadFromCSV(ordered.map(leadToStopPayload));
    setTimeout(() => {
      void runOptimisation();
    }, 0);
  };

  const canOptimise = activeSelectedIds.length >= 2 && !isOptimising;

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
            <RouteMap driverLocation={driverLocation} />
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
      <header className="shrink-0 border-b border-border bg-card px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Route className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
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
        <LeadSearchField
          value={filters.search}
          disabled={leadsLoading}
          leads={leads}
          onChange={(search) => setFilters((f) => ({ ...f, search }))}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-xs"
            disabled={leadsLoading}
            onClick={() => void reloadLeads()}
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", leadsLoading && "animate-spin")} />
            Sync raw data
          </Button>
        </div>

        <Collapsible defaultOpen className="rounded-lg border border-border bg-card/50">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors rounded-lg"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Location filters
              </span>
              <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border/60">
              <LocationMultiSelect
                label="State"
                allSummary="All states"
                options={stateOptions}
                selected={filters.states}
                disabled={leadsLoading || leads.length === 0}
                onSelectedChange={(states) => setFilters((f) => ({ ...f, states }))}
              />
              <LocationMultiSelect
                label="City"
                allSummary="All cities"
                options={cityOptions}
                selected={filters.cities}
                disabled={leadsLoading || leads.length === 0}
                onSelectedChange={(cities) => setFilters((f) => ({ ...f, cities }))}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex-1 flex flex-col min-h-0 relative">
        {isMobile ? (
          <div className="flex flex-col flex-1 min-h-0">
            {/* ── Native segmented control (top) ── */}
            <div className="shrink-0 px-3 pt-3 pb-2">
              <div className="flex rounded-lg border border-border bg-muted/40 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setBrowseTab("list")}
                  className={cn(
                    "flex-1 min-h-9 rounded-md text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors",
                    browseTab === "list"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <List className="w-3.5 h-3.5" />
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setBrowseTab("map")}
                  className={cn(
                    "flex-1 min-h-9 rounded-md text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors",
                    browseTab === "map"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  Map
                </button>
              </div>
            </div>

            {/* ── Pull-to-refresh scroll area ── */}
            <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-28 pt-2"
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop === 0 && !leadsLoading) {
                  void reloadLeads();
                }
              }}
            >
              {browseTab === "list" ? (
                <LeadList
                  leads={filtered}
                  selectedIds={selectedIds}
                  visitedIds={visitedIds}
                  onToggle={toggleSelect}
                  onRemove={removeFromSelection}
                  onMarkVisited={markVisited}
                  onOpenDetail={openDetail}
                />
              ) : (
                <div className="absolute inset-3 flex flex-col min-h-0">
                  <MapPinsRouteSegment
                    mapSubMode={mapSubMode}
                    onMapSubMode={setMapSubMode}
                    leads={filtered}
                    fitKey={fitKey}
                    highlightedId={detailLead?.id ?? null}
                    driverLocation={driverLocation}
                    onMarkerClick={openDetail}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 flex-row">
            <div className="w-full max-w-md shrink-0 border-r border-border overflow-y-auto p-4 pb-28 min-h-0">
              <LeadList
                leads={filtered}
                selectedIds={selectedIds}
                visitedIds={visitedIds}
                onToggle={toggleSelect}
                onRemove={removeFromSelection}
                onMarkVisited={markVisited}
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
                  driverLocation={driverLocation}
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
              <span className="font-mono font-semibold text-foreground">{activeSelectedIds.length}</span>{" "}
              selected
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 px-4"
                disabled={filtered.length === 0}
                onClick={selectAllFiltered}
              >
                Add all leads
              </Button>
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
                <Button className="w-full min-h-11" variant="outline" asChild>
                  <a
                    href={leadGoogleMapsUrl(detailLead)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in Google Maps
                  </a>
                </Button>
                <Button
                  className="w-full min-h-11"
                  variant={selectedIds.includes(detailLead.id) ? "secondary" : "default"}
                  onClick={() => {
                    toggleSelect(detailLead.id);
                  }}
                >
                  {selectedIds.includes(detailLead.id) ? "Remove from route" : "Add to route"}
                </Button>
                <Button
                  className="w-full min-h-11"
                  variant="outline"
                  onClick={() => markVisited(detailLead.id)}
                >
                  Mark as visited
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
  visitedIds,
  onToggle,
  onRemove,
  onMarkVisited,
  onOpenDetail,
}: {
  leads: Lead[];
  selectedIds: string[];
  visitedIds: string[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onMarkVisited: (id: string) => void;
  onOpenDetail: (lead: Lead) => void;
}) {
  return (
    <ul className="space-y-2">
      {leads.map((lead) => {
        const sel = selectedIds.indexOf(lead.id);
        const selected = sel >= 0;
        const visited = visitedIds.includes(lead.id);
        return (
          <li key={lead.id}>
            <SwipeLeadItem
              onSwipeLeft={() => onRemove(lead.id)}
              onSwipeRight={() => onMarkVisited(lead.id)}
            >
              <button
                type="button"
                onClick={() => onOpenDetail(lead)}
                className={cn(
                  "w-full text-left rounded-2xl border px-3 py-3 transition-colors",
                  "bg-slate-900 text-slate-100 border-slate-700 hover:bg-slate-800",
                  selected && "ring-2 ring-cyan-400/70",
                  visited && "opacity-75"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 h-10 w-10 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold",
                      visited ? "bg-emerald-500/20 text-emerald-300" : "bg-cyan-500/20 text-cyan-200"
                    )}
                  >
                    {lead.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((s) => s[0] ?? "")
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-[15px] leading-tight truncate">{lead.name}</p>
                      <p className="text-xs text-slate-300 shrink-0">{formatMoney(lead.totalSales)}</p>
                    </div>
                    <p className="text-sm text-slate-300 mt-1 truncate">{lead.address}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                      {selected && (
                        <span className="inline-flex items-center rounded-full bg-cyan-500/20 text-cyan-200 px-2 py-0.5">
                          In route #{sel + 1}
                        </span>
                      )}
                      {visited && (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/20 text-emerald-300 px-2 py-0.5">
                          Visited
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            </SwipeLeadItem>
          </li>
        );
      })}
    </ul>
  );
}

function SwipeLeadItem({
  children,
  onSwipeLeft,
  onSwipeRight,
}: {
  children: ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    startXRef.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = e.clientX - startXRef.current;
    setX(Math.max(-120, Math.min(120, dx)));
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (x <= -72) onSwipeLeft();
    if (x >= 72) onSwipeRight();
    setX(0);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-semibold">
        <div className="h-full w-1/2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center pl-2">
          <CheckCircle2 className="w-4 h-4 mr-1.5" />
          Visited
        </div>
        <div className="h-full w-1/2 bg-rose-500/15 text-rose-700 dark:text-rose-300 flex items-center justify-end pr-2">
          Remove
          <Trash2 className="w-4 h-4 ml-1.5" />
        </div>
      </div>
      <div
        className={cn("relative touch-pan-y", dragging ? "transition-none" : "transition-transform duration-200")}
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>
    </div>
  );
}

export default function SalesFieldPrototype() {
  return (
    <RouteProvider>
      <SalesFieldInner />
    </RouteProvider>
  );
}
