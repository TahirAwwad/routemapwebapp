// ============================================================
// Route Optimizer — Route Context
// Manages all stop state and optimisation results globally.
// Includes city filter support and hover highlight state.
// ============================================================

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { nanoid } from "nanoid";
import type { Stop, StopRole, OptimisedRoute, AppStep } from "@/lib/types";
import { optimiseRoute, type OptimisationProgress } from "@/lib/routeOptimizer";

interface RouteContextValue {
  stops: Stop[];
  filteredStops: Stop[];           // stops after city filter applied
  result: OptimisedRoute | null;
  step: AppStep;
  selectedSegment: "all" | number;  // which segment to show on map
  setSelectedSegment: (seg: "all" | number) => void;
  error: string | null;
  isOptimising: boolean;
  optimisingMessage: string;
  mapRef: React.MutableRefObject<google.maps.Map | null>;
  hoveredStopId: string | null;
  setHoveredStopId: (id: string | null) => void;

  // City filter
  excludedCities: Set<string>;
  toggleCity: (cityKey: string) => void;
  selectAllCities: () => void;
  excludeAllCities: () => void;

  addStop: (stop: Omit<Stop, "id" | "role">) => void;
  removeStop: (id: string) => void;
  setStopRole: (id: string, role: StopRole) => void;
  clearAllStops: () => void;
  loadFromCSV: (stops: Omit<Stop, "id" | "role">[]) => void;
  runOptimisation: () => Promise<void>;
  resetToInput: () => void;
  removeFromResult: (id: string) => void;
}

const RouteContext = createContext<RouteContextValue | null>(null);

// Re-assign origin/destination roles if they were removed
function rebalanceRoles(stops: Stop[]): Stop[] {
  if (stops.length === 0) return stops;

  const hasOrigin = stops.some((s) => s.role === "origin");
  const hasDestination = stops.some((s) => s.role === "destination");

  const result = [...stops];

  if (!hasOrigin && result.length > 0) {
    result[0] = { ...result[0], role: "origin" };
  }
  if (!hasDestination && result.length > 1) {
    result[result.length - 1] = {
      ...result[result.length - 1],
      role: "destination",
    };
  }

  return result;
}

/** Build the city key used in the filter (matches CityFilter component). */
function cityKey(stop: { city?: string; state?: string }): string {
  const city = stop.city?.trim() || "Unknown";
  const state = stop.state?.trim() || "";
  return `${city}||${state}`;
}

export function RouteProvider({ children }: { children: React.ReactNode }) {
  const [stops, setStops] = useState<Stop[]>([]);
  const [result, setResult] = useState<OptimisedRoute | null>(null);
  const [step, setStep] = useState<AppStep>("input");
  const [error, setError] = useState<string | null>(null);
  const [isOptimising, setIsOptimising] = useState(false);
  const [optimisingMessage, setOptimisingMessage] = useState("Optimising route…");
  const [hoveredStopId, setHoveredStopId] = useState<string | null>(null);
  const [excludedCities, setExcludedCities] = useState<Set<string>>(new Set());
  const [selectedSegment, setSelectedSegment] = useState<"all" | number>("all");
  const mapRef = useRef<google.maps.Map | null>(null);

  // Always-fresh ref for async operations
  const stopsRef = useRef<Stop[]>(stops);
  stopsRef.current = stops;

  // Derived: stops after city filter
  const filteredStops = useMemo(() => {
    if (excludedCities.size === 0) return stops;
    return rebalanceRoles(stops.filter((s) => !excludedCities.has(cityKey(s))));
  }, [stops, excludedCities]);

  // ── City filter actions ──────────────────────────────────────

  const toggleCity = useCallback((key: string) => {
    setExcludedCities((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAllCities = useCallback(() => {
    setExcludedCities(new Set());
  }, []);

  const excludeAllCities = useCallback(() => {
    setExcludedCities((prev) => {
      const next = new Set(prev);
      stopsRef.current.forEach((s) => next.add(cityKey(s)));
      return next;
    });
  }, []);

  // ── Stop management ──────────────────────────────────────────

  const addStop = useCallback((stop: Omit<Stop, "id" | "role">) => {
    setStops((prev) => {
      let role: StopRole = "waypoint";
      const hasOrigin = prev.some((s) => s.role === "origin");
      const hasDestination = prev.some((s) => s.role === "destination");
      if (!hasOrigin) role = "origin";
      else if (!hasDestination) role = "destination";
      return [...prev, { ...stop, id: nanoid(), role }];
    });
  }, []);

  const removeStop = useCallback((id: string) => {
    setStops((prev) => rebalanceRoles(prev.filter((s) => s.id !== id)));
  }, []);

  const setStopRole = useCallback((id: string, role: StopRole) => {
    setStops((prev) =>
      prev.map((s) => {
        if (s.id === id) return { ...s, role };
        if (s.role === role && (role === "origin" || role === "destination")) {
          return { ...s, role: "waypoint" as StopRole };
        }
        return s;
      })
    );
  }, []);

  const clearAllStops = useCallback(() => {
    setStops([]);
    setResult(null);
    setStep("input");
    setError(null);
    setExcludedCities(new Set());
    setSelectedSegment("all");
  }, []);

  const loadFromCSV = useCallback((newStops: Omit<Stop, "id" | "role">[]) => {
    const withIds: Stop[] = newStops.map((s, i) => ({
      ...s,
      id: nanoid(),
      role:
        i === 0
          ? "origin"
          : i === newStops.length - 1
          ? "destination"
          : "waypoint",
    }));
    setStops(withIds);
    setResult(null);
    setStep("input");
    setError(null);
    setExcludedCities(new Set()); // reset filter on new CSV
  }, []);

  // ── Optimisation ─────────────────────────────────────────────

  const handleProgress = useCallback((p: OptimisationProgress) => {
    setOptimisingMessage(p.message);
  }, []);

  const runOptimisationWith = useCallback(async (currentStops: Stop[]) => {
    const origin = currentStops.find((s) => s.role === "origin");
    const destination = currentStops.find((s) => s.role === "destination");

    if (!origin) {
      setError("Please designate an origin stop.");
      setStep("input");
      setIsOptimising(false);
      return;
    }
    if (!destination) {
      setError("Please designate a destination stop.");
      setStep("input");
      setIsOptimising(false);
      return;
    }
    if (!window.google) {
      setError("Google Maps is not loaded yet. Please wait a moment and try again.");
      setStep("input");
      setIsOptimising(false);
      return;
    }

    try {
      const optimised = await optimiseRoute(currentStops, handleProgress);
      setResult(optimised);
      setStep("results");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unknown error occurred.";
      setError(msg);
      setStep("input");
    } finally {
      setIsOptimising(false);
    }
  }, [handleProgress]);

  const runOptimisation = useCallback(async () => {
    setIsOptimising(true);
    setError(null);
    setOptimisingMessage("Optimising route…");
    setStep("optimising");
    // Use filtered stops (city filter applied)
    const toOptimise = excludedCities.size === 0
      ? stopsRef.current
      : rebalanceRoles(stopsRef.current.filter((s) => !excludedCities.has(cityKey(s))));
    await runOptimisationWith(toOptimise);
  }, [runOptimisationWith, excludedCities]);

  const resetToInput = useCallback(() => {
    setStep("input");
    setResult(null);
    setError(null);
    setSelectedSegment("all");
  }, []);

  const removeFromResult = useCallback(
    (id: string) => {
      const updatedStops = rebalanceRoles(
        stopsRef.current.filter((s) => s.id !== id)
      );
      setStops(updatedStops);
      setResult(null);
      setError(null);

      if (updatedStops.length < 2) {
        setStep("input");
        return;
      }

      setIsOptimising(true);
      setOptimisingMessage("Re-optimising route…");
      setStep("optimising");

      setTimeout(() => {
        runOptimisationWith(updatedStops);
      }, 50);
    },
    [runOptimisationWith]
  );

  return (
    <RouteContext.Provider
      value={{
        stops,
        filteredStops,
        result,
        step,
        error,
        isOptimising,
        optimisingMessage,
        mapRef,
        hoveredStopId,
        setHoveredStopId,
        selectedSegment,
        setSelectedSegment,
        excludedCities,
        toggleCity,
        selectAllCities,
        excludeAllCities,
        addStop,
        removeStop,
        setStopRole,
        clearAllStops,
        loadFromCSV,
        runOptimisation,
        resetToInput,
        removeFromResult,
      }}
    >
      {children}
    </RouteContext.Provider>
  );
}

export function useRoute() {
  const ctx = useContext(RouteContext);
  if (!ctx) throw new Error("useRoute must be used inside RouteProvider");
  return ctx;
}
