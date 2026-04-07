// ============================================================
// CityFilter — Two-level State → City filter
// Users can exclude entire states or individual cities.
// ============================================================

import { useMemo, useState } from "react";
import { Filter, ChevronDown, CheckSquare, Square, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface CityFilterProps {
  stops: { city?: string; state?: string }[];
  excludedCities: Set<string>;
  onToggleCity: (cityKey: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
}

interface StateGroup {
  state: string;
  cities: { key: string; label: string; count: number }[];
  totalCount: number;
}

export function CityFilter({
  stops,
  excludedCities,
  onToggleCity,
  onSelectAll,
  onClearAll,
}: CityFilterProps) {
  const [open, setOpen] = useState(false);
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());

  // Build state → city hierarchy
  const stateGroups = useMemo(() => {
    // city key → { label, count, state }
    const cityMap = new Map<string, { label: string; count: number; state: string }>();
    for (const stop of stops) {
      const city = stop.city?.trim() || "Unknown";
      const state = stop.state?.trim() || "Unknown";
      const key = `${city}||${state}`;
      const label = city;
      const existing = cityMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        cityMap.set(key, { label, count: 1, state });
      }
    }

    // Group by state
    const stateMap = new Map<string, StateGroup>();
    for (const [key, { label, count, state }] of Array.from(cityMap.entries())) {
      if (!stateMap.has(state)) {
        stateMap.set(state, { state, cities: [], totalCount: 0 });
      }
      const sg = stateMap.get(state)!;
      sg.cities.push({ key, label, count });
      sg.totalCount += count;
    }

    // Sort states, sort cities within each state
    return Array.from(stateMap.values())
      .sort((a, b) => a.state.localeCompare(b.state))
      .map((sg) => ({
        ...sg,
        cities: sg.cities.sort((a, b) => a.label.localeCompare(b.label)),
      }));
  }, [stops]);

  if (stateGroups.length === 0) return null;

  const totalCities = stateGroups.reduce((sum, sg) => sum + sg.cities.length, 0);
  const includedCitiesCount = stateGroups
    .flatMap((sg) => sg.cities)
    .filter((c) => !excludedCities.has(c.key)).length;

  const allSelected = excludedCities.size === 0;
  const noneSelected = stateGroups.flatMap((sg) => sg.cities).every((c) => excludedCities.has(c.key));

  function toggleState(sg: StateGroup) {
    const allExcluded = sg.cities.every((c) => excludedCities.has(c.key));
    if (allExcluded) {
      // Include all cities in this state
      sg.cities.forEach((c) => {
        if (excludedCities.has(c.key)) onToggleCity(c.key);
      });
    } else {
      // Exclude all cities in this state
      sg.cities.forEach((c) => {
        if (!excludedCities.has(c.key)) onToggleCity(c.key);
      });
    }
  }

  function getStateStatus(sg: StateGroup): "all" | "none" | "partial" {
    const excluded = sg.cities.filter((c) => excludedCities.has(c.key)).length;
    if (excluded === 0) return "all";
    if (excluded === sg.cities.length) return "none";
    return "partial";
  }

  function toggleStateExpand(state: string) {
    setExpandedStates((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Main toggle header */}
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/30 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            Filter by State / City
          </span>
          <span className="text-xs text-muted-foreground">
            {includedCitiesCount}/{totalCities} cities
          </span>
          {excludedCities.size > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
              {excludedCities.size} excluded
            </span>
          )}
        </div>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Filter panel */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="filter-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border">
              {/* Select all / Clear all */}
              <div className="flex items-center gap-2 px-3 py-2 bg-secondary/20">
                <button
                  className="text-xs text-primary font-medium hover:underline disabled:opacity-40"
                  onClick={onSelectAll}
                  disabled={allSelected}
                >
                  Include all
                </button>
                <span className="text-muted-foreground text-xs">·</span>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-40"
                  onClick={onClearAll}
                  disabled={noneSelected}
                >
                  Exclude all
                </button>
              </div>

              {/* State groups */}
              <div className="max-h-64 overflow-y-auto">
                {stateGroups.map((sg) => {
                  const status = getStateStatus(sg);
                  const isExpanded = expandedStates.has(sg.state);

                  return (
                    <div key={sg.state} className="border-t border-border/50 first:border-t-0">
                      {/* State row */}
                      <div className="flex items-center gap-0">
                        {/* State checkbox */}
                        <button
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 flex-1 text-left hover:bg-secondary/30 transition-colors",
                            status === "none" && "opacity-50"
                          )}
                          onClick={() => toggleState(sg)}
                        >
                          {status === "all" ? (
                            <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                          ) : status === "none" ? (
                            <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <Minus className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-foreground flex-1">
                            {sg.state}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0 mr-1">
                            {sg.cities.filter((c) => !excludedCities.has(c.key)).length}/{sg.cities.length} cities · {sg.totalCount} stops
                          </span>
                        </button>
                        {/* Expand cities chevron */}
                        <button
                          className="px-2 py-2 hover:bg-secondary/30 transition-colors"
                          onClick={() => toggleStateExpand(sg.state)}
                          title={isExpanded ? "Collapse cities" : "Expand cities"}
                        >
                          <ChevronDown
                            className={cn(
                              "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </button>
                      </div>

                      {/* City rows (expandable) */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            key={`cities-${sg.state}`}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="bg-secondary/10 border-t border-border/30">
                              {sg.cities.map(({ key, label, count }) => {
                                const included = !excludedCities.has(key);
                                return (
                                  <button
                                    key={key}
                                    className={cn(
                                      "w-full flex items-center gap-2.5 pl-8 pr-3 py-1.5 text-left hover:bg-secondary/30 transition-colors",
                                      !included && "opacity-50"
                                    )}
                                    onClick={() => onToggleCity(key)}
                                  >
                                    {included ? (
                                      <CheckSquare className="w-3 h-3 text-primary shrink-0" />
                                    ) : (
                                      <Square className="w-3 h-3 text-muted-foreground shrink-0" />
                                    )}
                                    <span className="text-xs text-foreground flex-1 truncate">
                                      {label}
                                    </span>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      {count}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
