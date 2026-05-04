// ============================================================
// Route Optimizer — Core Optimisation Logic
//
// Strategy:
//   1. Nearest-neighbour geographic pre-sort of all waypoints
//      so geographically close stops end up in the same segment.
//   2. Split into segments of ≤ MAX_WAYPOINTS_PER_CHUNK (23),
//      making the minimum number of API calls to cover ALL stops.
//   3. Each segment's last stop becomes the next segment's origin,
//      keeping the full journey continuous.
//   4. Each segment produces its own Google Maps URL (≤25 stops).
// ============================================================

import type { Stop, RouteLeg, OptimisedRoute, RouteSegment } from "./types";

const MAX_WAYPOINTS_PER_CHUNK = 23; // Google Maps hard limit

// ── Formatters ────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

// ── Google Maps URL builder (max 25 stops per URL) ────────────

function buildGoogleMapsUrl(stops: Stop[]): string {
  if (stops.length < 2) return "";
  const enc = (s: Stop) => encodeURIComponent(`${s.lat},${s.lng}`);
  let url = `https://www.google.com/maps/dir/${enc(stops[0])}/`;
  for (const s of stops.slice(1, -1)) url += `${enc(s)}/`;
  url += `${enc(stops[stops.length - 1])}/`;
  return url;
}

// ── Haversine distance (metres) ───────────────────────────────

function haversine(a: Stop, b: Stop): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sin2 = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(sin2));
}

// ── Nearest-neighbour geographic pre-sort ────────────────────
// Produces a rough geographic ordering of waypoints so that
// stops close together end up in the same API chunk.

function nearestNeighbourSort(waypoints: Stop[], startFrom: Stop): Stop[] {
  if (waypoints.length === 0) return [];
  const remaining = [...waypoints];
  const sorted: Stop[] = [];
  let current = startFrom;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = haversine(current, remaining[0]);
    for (let i = 1; i < remaining.length; i++) {
      const d = haversine(current, remaining[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    sorted.push(next);
    current = next;
  }
  return sorted;
}

// ── Single-chunk Directions API call ─────────────────────────

function optimiseChunk(
  chunkOrigin: Stop,
  chunkDestination: Stop,
  chunkWaypoints: Stop[]
): Promise<{ orderedWaypoints: Stop[]; legs: google.maps.DirectionsLeg[] }> {
  return new Promise((resolve, reject) => {
    const service = new google.maps.DirectionsService();

    service.route(
      {
        origin: new google.maps.LatLng(chunkOrigin.lat, chunkOrigin.lng),
        destination: new google.maps.LatLng(chunkDestination.lat, chunkDestination.lng),
        waypoints: chunkWaypoints.map((wp) => ({
          location: new google.maps.LatLng(wp.lat, wp.lng),
          stopover: true,
        })),
        optimizeWaypoints: true,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result) {
          reject(new Error(`Directions API error: ${status}`));
          return;
        }
        const route = result.routes[0];
        resolve({
          orderedWaypoints: route.waypoint_order.map((i) => chunkWaypoints[i]),
          legs: route.legs,
        });
      }
    );
  });
}

// ── Main export ───────────────────────────────────────────────

export interface OptimisationProgress {
  currentSegment: number;
  totalSegments: number;
  message: string;
}

export async function optimiseRoute(
  stops: Stop[],
  onProgress?: (p: OptimisationProgress) => void
): Promise<OptimisedRoute> {
  const origin = stops.find((s) => s.role === "origin");
  const destination = stops.find((s) => s.role === "destination");
  const waypoints = stops.filter((s) => s.role === "waypoint");

  if (!origin || !destination) {
    throw new Error("Origin and destination must be set before optimising.");
  }

  // ── Step 1: Geographic pre-sort ──────────────────────────────
  // Sort waypoints by nearest-neighbour from origin so geographically
  // close stops cluster together before we split into API chunks.
  const geoSorted = nearestNeighbourSort(waypoints, origin);

  // ── Step 2: Split into segments of ≤ 23 waypoints ────────────
  // Each segment = origin + up to 23 waypoints + destination
  // Total segments = ceil(waypoints / 23)
  const chunks: Stop[][] = [];
  for (let i = 0; i < geoSorted.length; i += MAX_WAYPOINTS_PER_CHUNK) {
    chunks.push(geoSorted.slice(i, i + MAX_WAYPOINTS_PER_CHUNK));
  }
  if (chunks.length === 0) chunks.push([]); // direct origin→destination

  const totalSegments = chunks.length;

  // ── Step 3: Optimise each segment sequentially ───────────────
  const segments: RouteSegment[] = [];
  let segmentOrigin = origin;

  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const chunk = chunks[i];

    onProgress?.({
      currentSegment: i + 1,
      totalSegments,
      message: totalSegments === 1
        ? "Optimising route…"
        : `Optimising segment ${i + 1} of ${totalSegments}…`,
    });

    // The destination for this segment:
    // - Last segment → user's chosen destination
    // - Intermediate segments → the geographically nearest stop from the
    //   NEXT chunk to the last stop of this chunk (minimises backtracking)
    let segmentDest: Stop;
    if (isLast) {
      segmentDest = destination;
    } else {
      // Pick the stop in the next chunk that is closest to the last stop
      // of the current chunk (after NN-sort the last stop is a reasonable
      // "exit point" of this cluster).
      const lastInChunk = chunk[chunk.length - 1] ?? segmentOrigin;
      const nextChunk = chunks[i + 1];
      let bestIdx = 0;
      let bestDist = haversine(lastInChunk, nextChunk[0]);
      for (let j = 1; j < nextChunk.length; j++) {
        const d = haversine(lastInChunk, nextChunk[j]);
        if (d < bestDist) { bestDist = d; bestIdx = j; }
      }
      // Remove the bridge stop from the next chunk entirely.
      // It becomes the next segment's origin (segmentOrigin = segmentDest below),
      // so it must NOT also appear as a waypoint in the next chunk.
      segmentDest = nextChunk.splice(bestIdx, 1)[0];
    }

    const { orderedWaypoints, legs } = await optimiseChunk(
      segmentOrigin,
      segmentDest,
      chunk
    );

    // Build the ordered stop list for this segment
    const segStops: Stop[] = [segmentOrigin, ...orderedWaypoints, segmentDest];

    // Build leg summaries
    const segLegs: RouteLeg[] = legs.map((leg, li) => ({
      from: segStops[li]?.name || segStops[li]?.address || leg.start_address,
      to: segStops[li + 1]?.name || segStops[li + 1]?.address || leg.end_address,
      distanceMeters: leg.distance?.value ?? 0,
      distanceText: leg.distance?.text ?? "",
      durationSeconds: leg.duration?.value ?? 0,
      durationText: leg.duration?.text ?? "",
    }));

    const segDistMeters = segLegs.reduce((s, l) => s + l.distanceMeters, 0);
    const segDurSeconds = segLegs.reduce((s, l) => s + l.durationSeconds, 0);

    segments.push({
      index: i,
      label: totalSegments === 1 ? "Full Route" : `Route ${i + 1} of ${totalSegments}`,
      orderedStops: segStops,
      legs: segLegs,
      totalDistanceMeters: segDistMeters,
      totalDistanceText: formatDistance(segDistMeters),
      totalDurationSeconds: segDurSeconds,
      totalDurationText: formatDuration(segDurSeconds),
      googleMapsUrl: buildGoogleMapsUrl(segStops),
    });

    // Next segment starts where this one ended
    segmentOrigin = segmentDest;

    // Respect API rate limits between calls
    if (!isLast) await new Promise((r) => setTimeout(r, 300));
  }

  // ── Step 4: Flatten into a single OptimisedRoute ─────────────
  // Bridge stops are no longer duplicated (they were removed from the next
  // chunk before the API call), so we can safely concatenate all segments.
  // The last stop of segment N == the first stop of segment N+1 (segmentOrigin),
  // so we skip the first stop of each segment after the first.
  const allStops: Stop[] = [...segments[0].orderedStops];
  for (const seg of segments.slice(1)) {
    // The first stop of this segment is the bridge stop, already the last
    // stop of the previous segment — skip it to avoid duplication.
    for (const s of seg.orderedStops.slice(1)) {
      allStops.push(s);
    }
  }

  const allLegs: RouteLeg[] = segments.flatMap((seg) => seg.legs);
  const totalDistanceMeters = allLegs.reduce((s, l) => s + l.distanceMeters, 0);
  const totalDurationSeconds = allLegs.reduce((s, l) => s + l.durationSeconds, 0);

  return {
    orderedStops: allStops,
    legs: allLegs,
    segments,
    totalDistanceMeters,
    totalDistanceText: formatDistance(totalDistanceMeters),
    totalDurationSeconds,
    totalDurationText: formatDuration(totalDurationSeconds),
    googleMapsUrl: buildGoogleMapsUrl(allStops.slice(0, 25)), // first 25 for header link
  };
}

// ── CSV Parser ────────────────────────────────────────────────

export function parseCSV(csvText: string): Omit<Stop, "id" | "role">[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV file appears to be empty or has no data rows.");

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const nameIdx = header.findIndex((h) => h === "name");
  const stateIdx = header.findIndex((h) => h === "state");
  const addressIdx = header.findIndex((h) => h === "address");
  const cityIdx = header.findIndex((h) => h === "city");
  const latlngIdx = header.findIndex((h) =>
    h.includes("long") || h.includes("lati") || h.includes("lat") || h.includes("lng") || h.includes("coordinates")
  );

  if (latlngIdx === -1) {
    throw new Error('CSV must have a "Long&Lati" column containing "latitude, longitude" values.');
  }

  const stops: Omit<Stop, "id" | "role">[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    const latlngRaw = cols[latlngIdx]?.trim() ?? "";
    if (!latlngRaw) continue;

    const parts = latlngRaw.split(",").map((p) => p.trim());
    if (parts.length < 2) continue;

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng)) continue;

    const name = nameIdx >= 0 ? (cols[nameIdx]?.trim() ?? "") : "";
    const state = stateIdx >= 0 ? (cols[stateIdx]?.trim() ?? "") : "";
    const address = addressIdx >= 0 ? (cols[addressIdx]?.trim() ?? "") : "";
    const city = cityIdx >= 0 ? (cols[cityIdx]?.trim() ?? "") : "";

    stops.push({
      name: name || address || `Stop ${i}`,
      address: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      city,
      state,
      lat,
      lng,
    });
  }

  if (stops.length === 0) {
    throw new Error("No valid stops found in the CSV. Check that coordinates are in the Long&Lati column.");
  }

  return stops;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
