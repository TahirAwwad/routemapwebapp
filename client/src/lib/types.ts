// ============================================================
// Route Optimizer — Shared Types
// Design: Clean Operational Dashboard (Swiss Grid Functionalism)
// ============================================================

export type StopRole = "origin" | "destination" | "waypoint";

export interface Stop {
  id: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  lat: number;
  lng: number;
  role: StopRole;
}

export interface RouteLeg {
  from: string;
  to: string;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
}

/**
 * A single API segment (≤ 25 stops / 23 waypoints).
 * Multiple segments are stitched together for routes with > 23 waypoints.
 */
export interface RouteSegment {
  index: number;
  label: string; // e.g. "Route 1 of 3"
  orderedStops: Stop[];
  legs: RouteLeg[];
  totalDistanceMeters: number;
  totalDistanceText: string;
  totalDurationSeconds: number;
  totalDurationText: string;
  googleMapsUrl: string; // URL for this segment only (≤ 25 stops)
}

export interface OptimisedRoute {
  orderedStops: Stop[];   // flat list of ALL stops in order (deduped bridge stops)
  legs: RouteLeg[];       // flat list of ALL legs
  segments: RouteSegment[]; // one per API call (each ≤ 25 stops)
  totalDistanceMeters: number;
  totalDistanceText: string;
  totalDurationSeconds: number;
  totalDurationText: string;
  googleMapsUrl: string;  // first-segment URL for the header Maps button
}

export type AppStep = "input" | "optimising" | "results";
