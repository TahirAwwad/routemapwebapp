// ============================================================
// ResultsPanel — Displays optimised route results
// Features:
//  - Segment colour coding (one colour per segment)
//  - Collapsible segment panels with Maps link per segment
//  - Remove-and-reoptimise per waypoint
//  - Hover highlight cross-linked with map
// ============================================================

import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation,
  Flag,
  MapPin,
  Clock,
  Route,
  ExternalLink,
  Trash2,
  ChevronDown,
  Layers,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoute } from "@/contexts/RouteContext";
import { getSegmentColor, buildStopSegmentMap, ORIGIN_COLOR, DESTINATION_COLOR } from "@/lib/clustering";
import type { Stop, RouteSegment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { exportRoutePdf } from "@/lib/exportPdf";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function StopRoleIcon({ role }: { role: Stop["role"] }) {
  if (role === "origin")
    return <Navigation className="w-3.5 h-3.5 text-white opacity-90" />;
  if (role === "destination")
    return <Flag className="w-3.5 h-3.5 text-white opacity-90" />;
  return <MapPin className="w-3.5 h-3.5 text-white opacity-90" />;
}

// ── Per-segment collapsible stop list ─────────────────────────

function SegmentPanel({
  segment,
  segmentIndex,
  globalOffset,
  stopSegmentMap,
  isMultiSegment,
  defaultOpen,
}: {
  segment: RouteSegment;
  segmentIndex: number;
  globalOffset: number;
  stopSegmentMap: number[];
  isMultiSegment: boolean;
  defaultOpen: boolean;
}) {
  const { removeFromResult, hoveredStopId, setHoveredStopId } = useRoute();
  const [open, setOpen] = useState(defaultOpen);
  const segColor = getSegmentColor(segmentIndex);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Segment header — always visible */}
      {isMultiSegment && (
        <button
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
          onClick={() => setOpen((v) => !v)}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Segment colour swatch */}
            <div
              className={cn(
                "w-3 h-3 rounded-full shrink-0 ring-2 ring-white shadow-sm",
                segColor.bg
              )}
            />
            <span className="text-sm font-semibold text-foreground truncate">
              {segment.label}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">
              {segment.orderedStops.length} stops · {segment.totalDistanceText} · {segment.totalDurationText}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <a
              href={segment.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md transition-colors",
                segColor.bg,
                segColor.text,
                "hover:opacity-90"
              )}
            >
              <ExternalLink className="w-3 h-3" />
              Maps
            </a>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </div>
        </button>
      )}

      {/* Stop list — collapsible for multi-segment, always open for single */}
      <AnimatePresence initial={false}>
        {(!isMultiSegment || open) && (
          <motion.div
            key="stops"
            initial={isMultiSegment ? { height: 0, opacity: 0 } : false}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className={cn("space-y-1", isMultiSegment ? "px-3 pb-3 pt-1" : "")}>
              <AnimatePresence mode="popLayout">
                {segment.orderedStops.map((stop, localIdx) => {
                  const globalIdx = globalOffset + localIdx;
                  const leg = segment.legs[localIdx];
                  const isLast = localIdx === segment.orderedStops.length - 1;
                  const isHovered = stop.id === hoveredStopId;

                  // Colour: origin/destination get fixed colours; waypoints get segment colour
                  const color =
                    stop.role === "origin"
                      ? ORIGIN_COLOR
                      : stop.role === "destination"
                      ? DESTINATION_COLOR
                      : segColor;

                  return (
                    <motion.div
                      key={stop.id}
                      layout
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12, height: 0 }}
                      transition={{ duration: 0.18, delay: localIdx * 0.015 }}
                      className="relative"
                      onMouseEnter={() => setHoveredStopId(stop.id)}
                      onMouseLeave={() => setHoveredStopId(null)}
                    >
                      {/* Connector line */}
                      {!isLast && (
                        <div
                          className="absolute left-[13px] top-[36px] bottom-0 w-px z-0"
                          style={{ backgroundColor: color.hex + "55" }}
                        />
                      )}

                      <div className="flex items-start gap-3 group">
                        {/* Step badge */}
                        <div
                          className={cn(
                            "stop-badge z-10 shrink-0 mt-1 transition-transform duration-150",
                            color.bg,
                            color.text,
                            isHovered && "scale-110 shadow-md"
                          )}
                        >
                          {globalIdx + 1}
                        </div>

                        {/* Stop card */}
                        <div
                          className={cn(
                            "flex-1 border rounded-lg px-3 py-2.5 mb-1 transition-all duration-150",
                            isHovered
                              ? "border-opacity-60 shadow-sm"
                              : "bg-card border-border hover:bg-secondary/30"
                          )}
                          style={
                            isHovered
                              ? { backgroundColor: color.hex + "12", borderColor: color.hex + "60" }
                              : undefined
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className={cn(
                                    "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                                    color.bg
                                  )}
                                >
                                  <StopRoleIcon role={stop.role} />
                                </div>
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {stop.name}
                                </p>
                              </div>
                              {stop.address && stop.address !== stop.name && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5 pl-6">
                                  {stop.address}
                                  {stop.city ? `, ${stop.city}` : ""}
                                  {stop.state ? `, ${stop.state}` : ""}
                                </p>
                              )}
                              {leg && (
                                <div className="flex items-center gap-3 mt-1.5 pl-6">
                                  <span className="data-value text-xs text-muted-foreground">
                                    → {leg.distanceText}
                                  </span>
                                  <span className="data-value text-xs text-muted-foreground">
                                    {leg.durationText}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Remove button — waypoints only */}
                            {stop.role === "waypoint" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => removeFromResult(stop.id)}
                                title="Remove stop and re-optimise"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────

export function ResultsPanel() {
  const { result } = useRoute();
  const [isExporting, setIsExporting] = useState(false);

  if (!result) return null;

  const {
    orderedStops,
    segments,
    totalDistanceText,
    totalDurationText,
    googleMapsUrl,
  } = result;

  const isMultiSegment = segments.length > 1;
  const stopSegmentMap = buildStopSegmentMap(segments);

  // Compute the global index offset for each segment
  const segmentOffsets: number[] = [];
  let offset = 0;
  for (const seg of segments) {
    segmentOffsets.push(offset);
    offset += seg.orderedStops.length - 1;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Route className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Total Distance
            </span>
          </div>
          <p className="data-value text-xl font-bold text-foreground">
            {totalDistanceText}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Est. Duration
            </span>
          </div>
          <p className="data-value text-xl font-bold text-foreground">
            {totalDurationText}
          </p>
        </div>
      </div>

      {/* Multi-segment notice */}
      {isMultiSegment && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
          <Layers className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <span className="font-semibold">{segments.length} route segments</span>
            {" "}— Google Maps limits 25 stops per link. Each segment has its own coloured line on the map and its own Maps button.
          </div>
        </div>
      )}

      {/* Open in Google Maps — single segment only */}
      {!isMultiSegment && (
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors shadow-sm"
        >
          <ExternalLink className="w-4 h-4" />
          Open Full Route in Google Maps
        </a>
      )}

      {/* Stop count + Export button */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          Optimised Route — {orderedStops.length} stops
          {isMultiSegment && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({segments.length} segments)
            </span>
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/5"
          disabled={isExporting}
          onClick={async () => {
            setIsExporting(true);
            try {
              await exportRoutePdf(result);
              toast.success("PDF downloaded", { description: "Route sheet saved to your downloads folder." });
            } catch (err) {
              console.error(err);
              toast.error("PDF export failed", { description: "Please try again." });
            } finally {
              setIsExporting(false);
            }
          }}
        >
          {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
          {isExporting ? "Generating…" : "Export PDF"}
        </Button>
      </div>

      {/* Segment panels */}
      <div className="space-y-3">
        {segments.map((seg, si) => (
          <SegmentPanel
            key={si}
            segment={seg}
            segmentIndex={si}
            globalOffset={segmentOffsets[si]}
            stopSegmentMap={stopSegmentMap}
            isMultiSegment={isMultiSegment}
            defaultOpen={si === 0} // first segment open by default
          />
        ))}
      </div>
    </motion.div>
  );
}
