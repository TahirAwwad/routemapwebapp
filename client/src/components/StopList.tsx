// ============================================================
// StopList — Displays and manages the list of stops
// Design: Clean Operational Dashboard
// Color-coded roles: green=origin, red=destination, teal=waypoint
// ============================================================

import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Flag, Navigation, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRoute } from "@/contexts/RouteContext";
import type { Stop, StopRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RoleConfig {
  label: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  Icon: (props: { className?: string }) => React.ReactElement;
}

const ROLE_CONFIG: Record<StopRole, RoleConfig> = {
  origin: {
    label: "Origin",
    color: "text-emerald-600",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
    Icon: ({ className }) => <Navigation className={className} />,
  },
  destination: {
    label: "Destination",
    color: "text-rose-600",
    badgeBg: "bg-rose-100",
    badgeText: "text-rose-700",
    Icon: ({ className }) => <Flag className={className} />,
  },
  waypoint: {
    label: "Waypoint",
    color: "text-teal-600",
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-700",
    Icon: ({ className }) => <MapPin className={className} />,
  },
};

function StopRow({ stop, index }: { stop: Stop; index: number }) {
  const { removeStop, setStopRole } = useRoute();
  const config = ROLE_CONFIG[stop.role];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-secondary/40 transition-colors group"
    >
      {/* Sequence number badge */}
      <div
        className={cn(
          "stop-badge mt-0.5 shrink-0",
          config.badgeBg,
          config.badgeText
        )}
      >
        {index + 1}
      </div>

      {/* Stop info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate leading-tight">
          {stop.name}
        </p>
        {stop.address && stop.address !== stop.name && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {stop.address}
            {stop.city ? `, ${stop.city}` : ""}
            {stop.state ? `, ${stop.state}` : ""}
          </p>
        )}
        <p className="data-value text-muted-foreground text-xs mt-1">
          {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
        </p>
      </div>

      {/* Role badge + controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
                config.badgeBg,
                config.badgeText,
                "hover:opacity-80"
              )}
            >
              <config.Icon className="w-3 h-3" />
              {config.label}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            {(["origin", "waypoint", "destination"] as StopRole[]).map(
              (role) => (
                <DropdownMenuItem
                  key={role}
                  onClick={() => setStopRole(stop.id, role)}
                  className={cn(
                    "text-xs",
                    stop.role === role && "font-semibold"
                  )}
                >
                  {(() => { const RoleIcon = ROLE_CONFIG[role].Icon; return <RoleIcon className="w-3 h-3 mr-2" />; })()}
                  {ROLE_CONFIG[role].label}
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => removeStop(stop.id)}
          title="Remove stop"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

export function StopList() {
  const { stops } = useRoute();

  if (stops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <MapPin className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No stops added yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add stops manually or upload a CSV file
        </p>
      </div>
    );
  }

  const origin = stops.find((s) => s.role === "origin");
  const destination = stops.find((s) => s.role === "destination");
  const waypoints = stops.filter((s) => s.role === "waypoint");

  // Display order: origin first, waypoints, destination last
  const ordered = [
    ...(origin ? [origin] : []),
    ...waypoints,
    ...(destination ? [destination] : []),
  ];

  return (
    <div className="space-y-1.5">
      <AnimatePresence mode="popLayout">
        {ordered.map((stop, i) => (
          <StopRow key={stop.id} stop={stop} index={i} />
        ))}
      </AnimatePresence>
    </div>
  );
}
