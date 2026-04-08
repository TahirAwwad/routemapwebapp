// ============================================================
// Home — Main page: two-panel operational dashboard
// Left: stop management (collapsible add-stops + city filter + stop list / results)
// Right: Google Maps view
// Design: Clean Operational Dashboard (Swiss Grid Functionalism)
// Navy/Teal palette · DM Sans + DM Mono typography
// ============================================================

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Upload,
  Loader2,
  Play,
  Trash2,
  AlertCircle,
  Route,
  LogOut,
  ChevronRight,
  ChevronDown,
  Plus,
  ExternalLink,
  RefreshCw,
  Layers,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AddressSearch } from "@/components/AddressSearch";
import { CSVUpload } from "@/components/CSVUpload";
import { StopList } from "@/components/StopList";
import { ResultsPanel } from "@/components/ResultsPanel";
import { RouteMap } from "@/components/RouteMap";
import { CityFilter } from "@/components/CityFilter";
import { useAuth } from "@/contexts/AuthContext";
import { RouteProvider, useRoute } from "@/contexts/RouteContext";

function AppContent() {
  const { logout } = useAuth();
  const {
    stops,
    step,
    error,
    isOptimising,
    optimisingMessage,
    runOptimisation,
    clearAllStops,
    result,
    excludedCities,
    toggleCity,
    selectAllCities,
    excludeAllCities,
    resetToInput,
    selectedSegment,
    setSelectedSegment,
  } = useRoute();

  const [segmentDropdownOpen, setSegmentDropdownOpen] = useState(false);
  const segmentDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (segmentDropdownRef.current && !segmentDropdownRef.current.contains(e.target as Node)) {
        setSegmentDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const [inputTab, setInputTab] = useState<"manual" | "csv">("manual");
  const [addStopsOpen, setAddStopsOpen] = useState(false); // collapsed by default

  const originSet = stops.some((s) => s.role === "origin");
  const destinationSet = stops.some((s) => s.role === "destination");
  const waypointCount = stops.filter((s) => s.role === "waypoint").length;

  // Filtered stop count (after city exclusions)
  const excludedCount = excludedCities.size > 0
    ? stops.filter((s) => {
        const city = s.city?.trim() || "Unknown";
        const state = s.state?.trim() || "";
        return excludedCities.has(`${city}||${state}`);
      }).length
    : 0;
  const activeStopCount = stops.length - excludedCount;

  const canOptimise = originSet && destinationSet && !isOptimising && activeStopCount >= 2;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* ── Header ── */}
      <header className="shrink-0 border-b border-border bg-sidebar text-sidebar-foreground px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Route className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight leading-none">
              Route Optimizer
            </h1>
            <p className="text-xs text-sidebar-foreground/60 mt-0.5">
              Driving · Google Maps
            </p>
          </div>
        </div>

        {/* Right side: badges + actions */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-sidebar-foreground shrink-0"
            onClick={() => logout()}
          >
            <LogOut className="w-3 h-3 mr-1" />
            Log out
          </Button>
          {stops.length > 0 && (
            <>
              <Badge
                variant="secondary"
                className="text-xs bg-sidebar-accent text-sidebar-accent-foreground border-0"
              >
                {stops.length} stop{stops.length !== 1 ? "s" : ""}
              </Badge>
              {waypointCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-sidebar-accent text-sidebar-accent-foreground border-0"
                >
                  {waypointCount} waypoint{waypointCount !== 1 ? "s" : ""}
                </Badge>
              )}
              {excludedCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-amber-100 text-amber-700 border-0"
                >
                  {excludedCount} excluded
                </Badge>
              )}
            </>
          )}

          {/* Route segment selector — visible when results have multiple segments */}
          {result && result.segments.length > 1 && step === "results" && (
            <div className="relative" ref={segmentDropdownRef}>
              <button
                onClick={() => setSegmentDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-sidebar-accent border border-sidebar-border text-sidebar-foreground text-xs font-medium hover:bg-sidebar-accent/80 transition-colors"
              >
                <Layers className="w-3 h-3" />
                {selectedSegment === "all"
                  ? "All Routes"
                  : result.segments[selectedSegment as number]?.label ?? `Route ${(selectedSegment as number) + 1}`}
                <ChevronDown className={`w-3 h-3 transition-transform ${segmentDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              <AnimatePresence>
                {segmentDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-1 z-50 min-w-[160px] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                  >
                    {/* All Routes option */}
                    <button
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                      onClick={() => { setSelectedSegment("all"); setSegmentDropdownOpen(false); }}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 via-orange-400 to-violet-500" />
                        <span className="font-medium text-gray-800">All Routes</span>
                      </div>
                      {selectedSegment === "all" && <Check className="w-3 h-3 text-blue-600" />}
                    </button>

                    <div className="border-t border-gray-100" />

                    {/* Per-segment options */}
                    {result.segments.map((seg, si) => {
                      const SEGMENT_COLORS = ["#2563eb","#f97316","#7c3aed","#f43f5e","#059669","#f59e0b","#0891b2","#ec4899"];
                      const hex = SEGMENT_COLORS[si % SEGMENT_COLORS.length];
                      return (
                        <button
                          key={si}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
                          onClick={() => { setSelectedSegment(si); setSegmentDropdownOpen(false); }}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hex }} />
                            <span className="font-medium text-gray-800">{seg.label}</span>
                            <span className="text-gray-400">{seg.orderedStops.length} stops</span>
                          </div>
                          {selectedSegment === si && <Check className="w-3 h-3 text-blue-600" />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Re-run optimisation — visible when results are showing */}
          {result && step === "results" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5 bg-sidebar-accent border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent/80"
              onClick={() => {
                resetToInput();
                // Small delay to let state settle, then re-run
                setTimeout(() => runOptimisation(), 80);
              }}
              disabled={isOptimising}
            >
              <RefreshCw className="w-3 h-3" />
              Re-run
            </Button>
          )}

          {/* Quick Google Maps link when results available */}
          {result && (
            <a
              href={result.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Maps
            </a>
          )}
        </div>
      </header>

      {/* ── Main two-panel layout ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left panel: controls ── */}
        <aside className="w-full max-w-[400px] shrink-0 flex flex-col border-r border-border bg-card overflow-hidden relative">
          <AnimatePresence mode="wait">
            {step !== "results" ? (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full overflow-hidden"
              >
                {/* ── Collapsible "Add Stops" section ── */}
                <div className="shrink-0 border-b border-border">
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/40 transition-colors"
                    onClick={() => setAddStopsOpen((v) => !v)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                        <Plus className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">
                        Add Stops
                      </span>
                      {stops.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          ({stops.length} added)
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                        addStopsOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {addStopsOpen && (
                      <motion.div
                        key="add-stops-content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-1">
                          <Tabs
                            value={inputTab}
                            onValueChange={(v) =>
                              setInputTab(v as "manual" | "csv")
                            }
                          >
                            <TabsList className="w-full h-8 mb-3">
                              <TabsTrigger value="manual" className="flex-1 text-xs">
                                <MapPin className="w-3 h-3 mr-1.5" />
                                Manual Entry
                              </TabsTrigger>
                              <TabsTrigger value="csv" className="flex-1 text-xs">
                                <Upload className="w-3 h-3 mr-1.5" />
                                CSV Upload
                              </TabsTrigger>
                            </TabsList>
                            <TabsContent value="manual" className="mt-0">
                              <AddressSearch />
                            </TabsContent>
                            <TabsContent value="csv" className="mt-0">
                              <CSVUpload />
                            </TabsContent>
                          </Tabs>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Stop list ── */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {/* City filter — only shown when stops have city data */}
                  {stops.length > 0 && stops.some((s) => s.city) && (
                    <CityFilter
                      stops={stops}
                      excludedCities={excludedCities}
                      onToggleCity={toggleCity}
                      onSelectAll={selectAllCities}
                      onClearAll={excludeAllCities}
                    />
                  )}

                  {stops.length > 0 && (
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Stops ({stops.length}
                        {excludedCount > 0 && (
                          <span className="text-amber-600"> · {activeStopCount} active</span>
                        )}
                        )
                      </h2>
                      <button
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                        onClick={clearAllStops}
                      >
                        <Trash2 className="w-3 h-3" />
                        Clear all
                      </button>
                    </div>
                  )}
                  <StopList />
                </div>

                {/* ── Validation hints ── */}
                <div className="px-4 pb-2 shrink-0">
                  {stops.length > 0 && (
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-1.5 text-xs">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            originSet ? "bg-emerald-500" : "bg-muted-foreground/30"
                          }`}
                        />
                        <span className={originSet ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                          Origin {originSet ? "set" : "not set"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            destinationSet ? "bg-rose-500" : "bg-muted-foreground/30"
                          }`}
                        />
                        <span className={destinationSet ? "text-rose-600 font-medium" : "text-muted-foreground"}>
                          Destination {destinationSet ? "set" : "not set"}
                        </span>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 mb-3">
                      <AlertCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                      <p className="text-xs text-destructive">{error}</p>
                    </div>
                  )}
                </div>

                {/* ── Optimise button ── */}
                <div className="p-4 pt-0 shrink-0">
                  <Button
                    className="w-full h-11 font-semibold text-sm"
                    onClick={runOptimisation}
                    disabled={!canOptimise}
                  >
                    {isOptimising ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {optimisingMessage}
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Optimise Route
                        {activeStopCount > 0 && (
                          <span className="ml-1.5 text-xs opacity-70">
                            ({activeStopCount} stops)
                          </span>
                        )}
                        {stops.length > 0 && (
                          <ChevronRight className="w-4 h-4 ml-1 opacity-60" />
                        )}
                      </>
                    )}
                  </Button>
                  {stops.length > 0 && !canOptimise && !isOptimising && (
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      {!originSet
                        ? "Set an origin to continue"
                        : !destinationSet
                        ? "Set a destination to continue"
                        : activeStopCount < 2
                        ? "At least 2 active stops required"
                        : ""}
                    </p>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full overflow-hidden"
              >
                {/* Results header with edit / re-run actions */}
                <div className="shrink-0 border-b border-border px-4 py-2.5 flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Optimised Route
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                      onClick={resetToInput}
                    >
                      Edit stops
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  <ResultsPanel />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Optimising overlay */}
          <AnimatePresence>
            {isOptimising && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 pointer-events-none"
              >
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                <p className="text-sm font-semibold text-foreground">
                  Optimising route...
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {optimisingMessage}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* ── Right panel: map ── */}
        <main className="flex-1 relative overflow-hidden">
          <RouteMap />
        </main>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <RouteProvider>
      <AppContent />
    </RouteProvider>
  );
}
