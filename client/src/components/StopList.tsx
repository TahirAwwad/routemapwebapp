// ============================================================
// StopList — Displays and manages the list of stops
// Design: Clean Operational Dashboard
// Color-coded roles: green=origin, red=destination, teal=waypoint
// Enhanced with: checkboxes, last-visit context, status tags
// ============================================================

import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Flag, Navigation, Trash2, ChevronDown, CheckCircle2, Clock, Circle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRoute } from "@/contexts/RouteContext";
import type { Stop, StopRole, StopStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<StopStatus, { label: string; Icon: React.ComponentType<{ className?: string }>; badge: string; text: string }> = {
  pending: {
    label: "Pending",
    Icon: Circle,
    badge: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
  },
  in_progress: {
    label: "In Progress",
    Icon: Clock,
    badge: "bg-blue-100 dark:bg-blue-900",
    text: "text-blue-700 dark:text-blue-300",
  },
  completed: {
    label: "Completed",
    Icon: CheckCircle2,
    badge: "bg-emerald-100 dark:bg-emerald-900",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  skipped: {
    label: "Skipped",
    Icon: Ban,
    badge: "bg-amber-100 dark:bg-amber-900",
    text: "text-amber-700 dark:text-amber-300",
  },
};

const STATUS_OPTIONS: StopStatus[] = ["pending", "in_progress", "completed", "skipped"];

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

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
  const { removeStop, setStopRole, toggleStopSelected, setStopStatus } = useRoute();
  const config = ROLE_CONFIG[stop.role];
  const statusConfig = STATUS_CONFIG[stop.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-secondary/40 transition-colors group",
        stop.selected && "border-primary/40 bg-primary/5"
      )}
    >
      {/* Checkbox */}
      <div className="shrink-0 mt-1">
        <Checkbox
          checked={stop.selected}
          onCheckedChange={() => toggleStopSelected(stop.id)}
          aria-label={`Select ${stop.name}`}
          className="transition-transform data-[state=checked]:scale-110"
        />
      </div>

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
        <div className="flex items-center gap-2 mt-1.5">
          <p className="data-value text-muted-foreground text-xs">
            {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
          </p>
          {/* Last visit context */}
          {stop.lastVisit && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(new Date(stop.lastVisit))}
            </span>
          )}
        </div>
      </div>

      {/* Status badge with dropdown */}
      <div className="shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer",
                statusConfig.badge,
                statusConfig.text,
                "hover:opacity-80"
              )}
            >
              <statusConfig.Icon className="w-3 h-3" />
              {statusConfig.label}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {STATUS_OPTIONS.map((status) => {
              const s = STATUS_CONFIG[status];
              return (
                <DropdownMenuItem
                  key={status}
                  onClick={() => setStopStatus(stop.id, status)}
                  className={cn(
                    "text-xs",
                    stop.status === status && "font-semibold"
                  )}
                >
                  <s.Icon className="w-3 h-3 mr-2" />
                  {s.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
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
  const { stops, selectedStops, selectAllStops, deselectAllStops, batchSetStatus } = useRoute();

  const allSelected = stops.length > 0 && selectedStops.size === stops.length;

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
    <div className="space-y-2">
      {/* Batch action header */}
      {selectedStops.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20"
        >
          <span className="text-xs font-medium text-primary">
            {selectedStops.size} stop{selectedStops.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => batchSetStatus("completed")}
            >
              <CheckCircle2 className="w-3 h-3" />
              Mark Done
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => batchSetStatus("skipped")}
            >
              <Ban className="w-3 h-3" />
              Skip
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={deselectAllStops}
            >
              Clear
            </Button>
          </div>
        </motion.div>
      )}

      {/* Select all / deselect all */}
      <div className="flex items-center gap-2 px-1">
        <Checkbox
          checked={allSelected}
          onCheckedChange={() => allSelected ? deselectAllStops() : selectAllStops()}
          aria-label={allSelected ? "Deselect all stops" : "Select all stops"}
        />
        <span className="text-xs text-muted-foreground">Select all</span>
      </div>

      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {ordered.map((stop, i) => (
            <StopRow key={stop.id} stop={stop} index={i} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
