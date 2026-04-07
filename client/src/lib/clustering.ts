// ============================================================
// Proximity Clustering — Groups stops by geographic proximity
// Also provides segment-based colour assignment for multi-segment routes.
// ============================================================

export interface ClusterColor {
  bg: string;         // Tailwind bg class
  text: string;       // Tailwind text class
  border: string;     // Tailwind border class
  hex: string;        // Hex for map marker / polyline
  name: string;       // Human-readable name
}

// Distinct, accessible colour palette for proximity clusters
export const CLUSTER_PALETTE: ClusterColor[] = [
  { bg: "bg-blue-500",    text: "text-white", border: "border-blue-600",    hex: "#3b82f6", name: "Blue"   },
  { bg: "bg-orange-500",  text: "text-white", border: "border-orange-600",  hex: "#f97316", name: "Orange" },
  { bg: "bg-violet-500",  text: "text-white", border: "border-violet-600",  hex: "#8b5cf6", name: "Violet" },
  { bg: "bg-rose-500",    text: "text-white", border: "border-rose-600",    hex: "#f43f5e", name: "Rose"   },
  { bg: "bg-emerald-500", text: "text-white", border: "border-emerald-600", hex: "#10b981", name: "Green"  },
  { bg: "bg-amber-500",   text: "text-white", border: "border-amber-600",   hex: "#f59e0b", name: "Amber"  },
  { bg: "bg-cyan-500",    text: "text-white", border: "border-cyan-600",    hex: "#06b6d4", name: "Cyan"   },
  { bg: "bg-pink-500",    text: "text-white", border: "border-pink-600",    hex: "#ec4899", name: "Pink"   },
];

// Segment colour palette — one colour per route segment, visually distinct
// These are used for: stop badges, map markers, and polyline strokes
export const SEGMENT_PALETTE: ClusterColor[] = [
  { bg: "bg-blue-600",    text: "text-white", border: "border-blue-700",    hex: "#2563eb", name: "Segment 1" },
  { bg: "bg-orange-500",  text: "text-white", border: "border-orange-600",  hex: "#f97316", name: "Segment 2" },
  { bg: "bg-violet-600",  text: "text-white", border: "border-violet-700",  hex: "#7c3aed", name: "Segment 3" },
  { bg: "bg-rose-500",    text: "text-white", border: "border-rose-600",    hex: "#f43f5e", name: "Segment 4" },
  { bg: "bg-emerald-600", text: "text-white", border: "border-emerald-700", hex: "#059669", name: "Segment 5" },
  { bg: "bg-amber-500",   text: "text-white", border: "border-amber-600",   hex: "#f59e0b", name: "Segment 6" },
  { bg: "bg-cyan-600",    text: "text-white", border: "border-cyan-700",    hex: "#0891b2", name: "Segment 7" },
  { bg: "bg-pink-500",    text: "text-white", border: "border-pink-600",    hex: "#ec4899", name: "Segment 8" },
];

/** Returns the colour for a given segment index (0-based). */
export function getSegmentColor(segmentIndex: number): ClusterColor {
  return SEGMENT_PALETTE[segmentIndex % SEGMENT_PALETTE.length];
}

// Special colours for origin and destination (always fixed)
export const ORIGIN_COLOR: ClusterColor = {
  bg: "bg-emerald-600",  text: "text-white", border: "border-emerald-700", hex: "#059669", name: "Origin"
};
export const DESTINATION_COLOR: ClusterColor = {
  bg: "bg-rose-600",     text: "text-white", border: "border-rose-700",    hex: "#e11d48", name: "Destination"
};

interface Point { lat: number; lng: number; index: number }

function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Assigns a cluster index to each stop (waypoints only).
 * Origin and destination always get their own fixed colour.
 * Waypoints are grouped by proximity using a greedy scan.
 *
 * Returns an array of cluster indices, one per stop (same order as input).
 * -1 = origin, -2 = destination, 0+ = cluster index.
 */
export function assignClusters(
  orderedStops: { lat: number; lng: number; role: string }[]
): number[] {
  const n = orderedStops.length;
  if (n === 0) return [];

  const result = new Array(n).fill(0);

  // Mark origin and destination
  for (let i = 0; i < n; i++) {
    if (orderedStops[i].role === "origin") result[i] = -1;
    else if (orderedStops[i].role === "destination") result[i] = -2;
  }

  // Compute distances between consecutive waypoints
  const waypoints = orderedStops
    .map((s, i) => ({ ...s, index: i }))
    .filter((s) => s.role === "waypoint");

  if (waypoints.length === 0) return result;

  // Compute consecutive distances
  const dists: number[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    dists.push(haversineKm(waypoints[i], waypoints[i + 1]));
  }

  // Median distance as threshold baseline
  const sorted = [...dists].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 50;
  const threshold = median * 1.5; // gap larger than 1.5x median → new cluster

  let clusterIdx = 0;
  result[waypoints[0].index] = clusterIdx;

  for (let i = 1; i < waypoints.length; i++) {
    const dist = dists[i - 1] ?? 0;
    if (dist > threshold) {
      clusterIdx = (clusterIdx + 1) % CLUSTER_PALETTE.length;
    }
    result[waypoints[i].index] = clusterIdx;
  }

  return result;
}

/**
 * Returns the ClusterColor for a given cluster assignment value.
 */
export function getClusterColor(assignment: number): ClusterColor {
  if (assignment === -1) return ORIGIN_COLOR;
  if (assignment === -2) return DESTINATION_COLOR;
  return CLUSTER_PALETTE[assignment % CLUSTER_PALETTE.length];
}

/**
 * Builds a per-stop segment index map from segments.
 * Returns an array (same length as orderedStops) where each entry is
 * the 0-based segment index that stop belongs to.
 */
export function buildStopSegmentMap(
  segments: { orderedStops: { lat: number; lng: number }[] }[]
): number[] {
  const map: number[] = [];
  for (let si = 0; si < segments.length; si++) {
    const seg = segments[si];
    // For all segments after the first, skip the first stop (bridge stop
    // already counted in the previous segment).
    const startIdx = si === 0 ? 0 : 1;
    for (let j = startIdx; j < seg.orderedStops.length; j++) {
      map.push(si);
    }
  }
  return map;
}
