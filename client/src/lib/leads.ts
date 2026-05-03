// ============================================================
// Sales field — leads from CSV or JSON URL + deterministic mock metrics
// ============================================================

import type { Stop } from "@/lib/types";

export interface Lead {
  id: string;
  clientNumber: string;
  name: string;
  city: string;
  state: string;
  address: string;
  lat: number;
  lng: number;
  totalSales: number;
  /** Single 1–5 score */
  ratingScore: number;
  lastOrder: string;
  lastOrderSummary: string;
  lastOrderAmount: number;
  openBalance: number;
}

export interface LeadFilters {
  search: string;
  /** Empty array = all states (no filter). Otherwise lead.state (trimmed) must be in the set. */
  states: string[];
  /** Empty array = all cities (no filter). Otherwise lead.city (trimmed) must be in the set. */
  cities: string[];
}

const ORDER_SUMMARIES = [
  "Beauty supplies restock",
  "Bulk hair products",
  "Seasonal display order",
  "Core SKU replenishment",
  "Promotional bundle",
  "Express pickup order",
  "Wholesale mixed case",
  "Accessory add-on shipment",
] as const;

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** On-demand geocode a single address via Google Maps Geocoding API.
 * Uses the app's VITE_GOOGLE_MAPS_API_KEY env var.
 * Returns { lat, lng } or throws if the address cannot be resolved. */
export async function geocodeAddress(
  address: string,
  city: string,
  state: string
): Promise<{ lat: number; lng: number }> {
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? "";
  if (!apiKey) throw new Error("VITE_GOOGLE_MAPS_API_KEY is not set");

  const query = [address, city, state].filter(Boolean).join(", ");
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding request failed: ${res.status}`);
  const data = (await res.json()) as {
    status: string;
    results?: Array<{ geometry: { location: { lat: number; lng: number } } }>;
  };

  if (data.status !== "OK" || !data.results?.[0]) {
    throw new Error(`Geocoding failed for "${query}": ${data.status}`);
  }

  const { lat, lng } = data.results[0].geometry.location;
  return { lat, lng };
}

/** Deterministic mock sales / rating / order fields from a stable id (e.g. client number). */
export function mockMetricsForLeadId(id: string) {
  const h = hashString(id);
  const totalSales = 50_000 + (h % 1_950_000);
  const ratingScore = 1 + (h % 5);
  const daysAgo = h % 90;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const lastOrder = d.toISOString().slice(0, 10);
  const lastOrderSummary = ORDER_SUMMARIES[h % ORDER_SUMMARIES.length];
  const lastOrderAmount = 120 + (h % 8_800);
  const openBalance = h % 4 === 0 ? (h % 12_000) / 100 : 0;
  return {
    totalSales,
    ratingScore,
    lastOrder,
    lastOrderSummary,
    lastOrderAmount: Math.round(lastOrderAmount * 100) / 100,
    openBalance: Math.round(openBalance * 100) / 100,
  };
}

/** Parse CSV with RFC-style quoted fields (handles commas and newlines inside quotes). */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      continue;
    } else {
      field += c;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") {
    rows.push(row);
  }
  return rows;
}

function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Parse `route_addresses.csv`-shaped text into `Lead` rows. */
export function parseRouteAddressesCsv(text: string): Lead[] {
  const rows = parseCsvRows(text.trim());
  if (rows.length < 2) return [];

  const headers = rows[0].map((c) => c.trim());
  const norm = headers.map(normalizeHeader);

  const idx = (name: string) => {
    const n = normalizeHeader(name);
    const i = norm.findIndex((h) => h === n || h.replace(/,/g, "") === n.replace(/,/g, ""));
    return i;
  };

  const iClient = idx("Client Number");
  const iName = idx("Name");
  const iState = idx("State");
  const iAddress = idx("Address");
  const iCity = idx("City");
  let iCoord = norm.findIndex((h) => h.includes("longitude") && h.includes("latitude"));
  if (iCoord < 0) {
    iCoord = headers.findIndex((h) => /longitude.*latitude/i.test(h));
  }

  if (iClient < 0 || iName < 0 || iState < 0 || iAddress < 0 || iCity < 0 || iCoord < 0) {
    console.error("parseRouteAddressesCsv: missing expected columns", { headers });
    return [];
  }

  const leads: Lead[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (cols.length < Math.max(iClient, iName, iState, iAddress, iCity, iCoord) + 1) continue;

    const clientNumber = (cols[iClient] ?? "").trim();
    const name = (cols[iName] ?? "").trim();
    const state = (cols[iState] ?? "").trim();
    const address = (cols[iAddress] ?? "").trim();
    const city = (cols[iCity] ?? "").trim();
    const coordRaw = (cols[iCoord] ?? "").trim();

    if (!clientNumber && !name) continue;

    const parts = coordRaw.split(",").map((p) => parseFloat(p.trim()));
    const lat = parts[0];
    const lng = parts[1];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const id = clientNumber ? `${clientNumber}-${r}` : `row-${r}`;
    const metrics = mockMetricsForLeadId(id);

    leads.push({
      id,
      clientNumber,
      name,
      city,
      state,
      address,
      lat,
      lng,
      ...metrics,
    });
  }

  return leads;
}

export function uniqueStates(leads: Lead[]): string[] {
  const set = new Set<string>();
  for (const l of leads) {
    const s = l.state.trim();
    if (s) set.add(s);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/** City options; when `statesFilter` is non-empty, only cities in those states are listed. */
export function uniqueCities(leads: Lead[], statesFilter: string[]): string[] {
  const stateSet =
    statesFilter.length > 0
      ? new Set(statesFilter.map((s) => s.trim()).filter(Boolean))
      : null;
  const set = new Set<string>();
  for (const l of leads) {
    if (stateSet && !stateSet.has(l.state.trim())) continue;
    const c = l.city.trim();
    if (c) set.add(c);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function leadGoogleMapsUrl(lead: Lead): string {
  if (Number.isFinite(lead.lat) && Number.isFinite(lead.lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lead.lat},${lead.lng}`;
  }
  const q = [lead.address, lead.city, lead.state].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function filterLeads(leads: Lead[], filters: LeadFilters): Lead[] {
  const q = filters.search.trim().toLowerCase();
  const stateSet =
    filters.states.length > 0
      ? new Set(filters.states.map((s) => s.trim()).filter(Boolean))
      : null;
  const citySet =
    filters.cities.length > 0
      ? new Set(filters.cities.map((c) => c.trim()).filter(Boolean))
      : null;

  return leads.filter((lead) => {
    if (stateSet) {
      const ls = lead.state.trim();
      if (!stateSet.has(ls)) return false;
    }
    if (citySet) {
      const lc = lead.city.trim();
      if (!citySet.has(lc)) return false;
    }
    if (q) {
      const name = lead.name.trim().toLowerCase();
      const code = lead.clientNumber.trim().toLowerCase();
      const nameMatch = name.includes(q);
      const codeMatch = code.includes(q);
      if (!nameMatch && !codeMatch) return false;
    }
    return true;
  });
}

export function formatMoney(
  amount: number,
  currency = "USD",
  options?: { maximumFractionDigits?: number; minimumFractionDigits?: number }
): string {
  const max = options?.maximumFractionDigits ?? 0;
  const min = options?.minimumFractionDigits ?? 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(amount);
}

export function leadToStopPayload(lead: Lead): Omit<Stop, "id" | "role"> {
  return {
    name: lead.name,
    address: lead.address,
    city: lead.city,
    state: lead.state,
    lat: lead.lat,
    lng: lead.lng,
    status: "pending",
    selected: false,
  };
}

export async function loadLeads(): Promise<Lead[]> {
  const jsonUrl = import.meta.env.VITE_LEADS_DATA_URL as string | undefined;
  if (jsonUrl?.trim()) {
    const res = await fetch(jsonUrl.trim());
    if (!res.ok) throw new Error(`Failed to load leads JSON (${res.status})`);
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) throw new Error("Leads JSON must be an array");
    return data as Lead[];
  }

  const base = import.meta.env.BASE_URL || "/";
  const csvPath = `${base.endsWith("/") ? base : `${base}/`}route_addresses.csv`;
  const res = await fetch(csvPath);
  if (!res.ok) throw new Error(`Failed to load route_addresses.csv (${res.status})`);
  const text = await res.text();
  const leads = parseRouteAddressesCsv(text);

  // On-demand geocode any rows that have an address but no static coordinates
  const missing = leads.filter((l) => !Number.isFinite(l.lat) && l.address.trim());
  if (missing.length > 0) {
    const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? "";
    if (apiKey) {
      const results = await Promise.allSettled(
        missing.map((l) => geocodeAddress(l.address, l.city, l.state))
      );
      let idx = 0;
      for (const lead of missing) {
        const result = results[idx++];
        if (result.status === "fulfilled") {
          lead.lat = result.value.lat;
          lead.lng = result.value.lng;
        }
      }
    }
  }

  return leads;
}
