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
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function filterLeads(leads: Lead[], filters: LeadFilters): Lead[] {
  const q = filters.search.trim().toLowerCase();
  const stateSet =
    filters.states.length > 0
      ? new Set(filters.states.map((s) => s.trim()).filter(Boolean))
      : null;

  return leads.filter((lead) => {
    if (stateSet) {
      const ls = lead.state.trim();
      if (!stateSet.has(ls)) return false;
    }
    if (q) {
      const hay = `${lead.clientNumber} ${lead.name} ${lead.city} ${lead.state} ${lead.address}`
        .toLowerCase();
      if (!hay.includes(q)) return false;
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
  return parseRouteAddressesCsv(text);
}
