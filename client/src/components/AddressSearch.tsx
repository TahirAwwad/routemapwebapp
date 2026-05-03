// ============================================================
// AddressSearch — Manual address entry with Google Maps geocoding
// Uses Google Maps Geocoder for address lookup
// ============================================================

import { useState, useRef, useEffect } from "react";
import { Search, Plus, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRoute } from "@/contexts/RouteContext";
import { cn } from "@/lib/utils";

interface GeoResult {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export function AddressSearch() {
  const { addStop } = useRoute();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function geocodeAddress(address: string) {
    if (!address.trim() || address.length < 3) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    if (!window.google?.maps?.Geocoder) {
      setError("Google Maps is loading. Please wait a moment.");
      return;
    }

    setIsSearching(true);
    setError(null);

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address }, (geoResults, status) => {
      setIsSearching(false);
      if (status === "OK" && geoResults && geoResults.length > 0) {
        const mapped: GeoResult[] = geoResults.slice(0, 5).map((r) => ({
          name: r.address_components?.[0]?.long_name || r.formatted_address,
          address: r.formatted_address,
          lat: r.geometry.location.lat(),
          lng: r.geometry.location.lng(),
        }));
        setResults(mapped);
        setShowDropdown(true);
      } else if (status === "ZERO_RESULTS") {
        setResults([]);
        setShowDropdown(true);
      } else {
        setError(`Geocoding failed: ${status}`);
        setResults([]);
        setShowDropdown(false);
      }
    });
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    setError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      geocodeAddress(val);
    }, 500);
  }

  function handleSelect(result: GeoResult) {
    addStop({
      name: result.name,
      address: result.address,
      lat: result.lat,
      lng: result.lng,
      status: "pending",
      selected: false,
    });
    setQuery("");
    setResults([]);
    setShowDropdown(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && query.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      geocodeAddress(query);
    }
    if (e.key === "Escape") {
      setShowDropdown(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            placeholder="Search address or place name..."
            className="pl-9 pr-4 h-10 text-sm"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
        </div>
        <Button
          size="sm"
          className="h-10 px-3 shrink-0"
          onClick={() => geocodeAddress(query)}
          disabled={!query.trim() || isSearching}
        >
          <Plus className="w-4 h-4" />
          <span className="ml-1 hidden sm:inline">Search</span>
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive mt-1.5 pl-1">{error}</p>
      )}

      {/* Dropdown results */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground text-center">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={i}>
                  <button
                    className={cn(
                      "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary transition-colors",
                      i < results.length - 1 && "border-b border-border"
                    )}
                    onClick={() => handleSelect(r)}
                  >
                    <MapPin className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {r.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {r.address}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
