// ============================================================
// exportPdf — Generates a formatted offline route sheet PDF
// Uses jsPDF + jspdf-autotable (browser-only, no server needed)
// Map image via Google Static Maps API (same proxy as JS API)
// ============================================================

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { OptimisedRoute } from "./types";
import type { Stop } from "./types";

// ── Segment colour palette (matches map/UI colours) ──────────
const SEGMENT_COLORS_HEX = [
  "#2563eb", // blue-600
  "#ea580c", // orange-600
  "#16a34a", // green-600
  "#9333ea", // purple-600
  "#dc2626", // red-600
  "#0284c7", // sky-600
  "#d97706", // amber-600
  "#0d9488", // teal-600
];

const SEGMENT_HEADER_COLORS: [number, number, number][] = SEGMENT_COLORS_HEX.map((hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
]);

// ── Google polyline encoder ───────────────────────────────────
// Encodes an array of lat/lng pairs into a Google encoded polyline string.
function encodePolyline(coords: { lat: number; lng: number }[]): string {
  let result = "";
  let prevLat = 0;
  let prevLng = 0;

  function encodeValue(value: number): string {
    let v = Math.round(value * 1e5);
    v = v < 0 ? ~(v << 1) : v << 1;
    let encoded = "";
    while (v >= 0x20) {
      encoded += String.fromCharCode(((0x20 | (v & 0x1f)) + 63));
      v >>= 5;
    }
    encoded += String.fromCharCode((v + 63));
    return encoded;
  }

  for (const coord of coords) {
    result += encodeValue(coord.lat - prevLat);
    result += encodeValue(coord.lng - prevLng);
    prevLat = coord.lat;
    prevLng = coord.lng;
  }
  return result;
}

// ── Build Static Maps URL ─────────────────────────────────────
// Generates a Google Static Maps API URL with:
//   - One encoded polyline per segment (colour-coded)
//   - Numbered markers for each stop (max 20 shown to keep URL short)
//   - Light map style
function buildStaticMapUrl(route: OptimisedRoute): string {
  const apiKey = (import.meta as unknown as { env: Record<string, string> }).env.VITE_FRONTEND_FORGE_API_KEY;
  const forgeBase =
    (import.meta as unknown as { env: Record<string, string> }).env.VITE_FRONTEND_FORGE_API_URL ||
    "https://forge.butterfly-effect.dev";
  const proxyBase = `${forgeBase}/v1/maps/proxy`;

  const params: string[] = [
    `key=${apiKey}`,
    "size=640x400",
    "scale=2",
    "maptype=roadmap",
    // Light/minimal map style — remove most POI clutter
    "style=feature:poi|visibility:off",
    "style=feature:transit|visibility:off",
    "style=feature:road|element:labels.icon|visibility:off",
    "style=feature:administrative.land_parcel|visibility:off",
    "style=feature:landscape.natural|color:0xf2f2f2",
    "style=feature:water|color:0xc9e8f5",
    "style=feature:road|color:0xffffff",
    "style=feature:road.arterial|color:0xffffff",
    "style=feature:road.highway|color:0xffd700|weight:1",
  ];

  // Add one polyline per segment
  route.segments.forEach((seg, si) => {
    const colorHex = SEGMENT_COLORS_HEX[si % SEGMENT_COLORS_HEX.length].replace("#", "0x");
    const coords = seg.orderedStops.map((s) => ({ lat: s.lat, lng: s.lng }));
    const encoded = encodePolyline(coords);
    params.push(`path=color:${colorHex}|weight:4|enc:${encoded}`);
  });

  // Add numbered markers — limit to 20 to keep URL under 8192 chars
  const allStops = route.orderedStops;
  const maxMarkers = Math.min(allStops.length, 20);
  const step = allStops.length <= 20 ? 1 : Math.ceil(allStops.length / 20);

  allStops.forEach((stop, i) => {
    if (i % step !== 0 && i !== allStops.length - 1) return;
    const markerNum = i + 1;
    if (markerNum > maxMarkers * step) return;

    // Determine segment colour for this stop
    let segIdx = 0;
    let count = 0;
    for (const seg of route.segments) {
      if (i < count + seg.orderedStops.length) { segIdx = seg.index; break; }
      count += seg.orderedStops.length - 1; // bridge stop shared
    }
    const color = SEGMENT_COLORS_HEX[segIdx % SEGMENT_COLORS_HEX.length].replace("#", "0x");
    const label = markerNum <= 9 ? String(markerNum) : "•";
    params.push(`markers=color:${color}|label:${label}|${stop.lat},${stop.lng}`);
  });

  // Always mark origin (green) and destination (red) prominently
  const origin = allStops[0];
  const dest = allStops[allStops.length - 1];
  if (origin) params.push(`markers=color:green|label:S|${origin.lat},${origin.lng}`);
  if (dest && dest !== origin) params.push(`markers=color:red|label:E|${dest.lat},${dest.lng}`);

  return `${proxyBase}/maps/api/staticmap?${params.join("&")}`;
}

// ── Fetch map image as base64 dataURL ─────────────────────────
async function fetchMapImageBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function formatDate(): string {
  return new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Main export (async to support map image fetch) ────────────
export async function exportRoutePdf(route: OptimisedRoute): Promise<void> {
  // Fetch the map image first (before building the PDF)
  const mapUrl = buildStaticMapUrl(route);
  const mapImageBase64 = await fetchMapImageBase64(mapUrl);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;

  // ── Page 1: Header + Summary + Map ──────────────────────────

  // Header bar
  doc.setFillColor(15, 23, 42); // navy
  doc.rect(0, 0, pageW, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Route Optimizer — Optimised Route Sheet", margin, 14);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(`Generated: ${formatDate()}`, pageW - margin, 14, { align: "right" });

  // Summary row
  let y = 30;

  const summaryItems = [
    { label: "Total Stops", value: String(route.orderedStops.length) },
    { label: "Total Distance", value: route.totalDistanceText },
    { label: "Est. Duration", value: route.totalDurationText },
    { label: "Segments", value: String(route.segments.length) },
  ];

  const boxW = contentW / summaryItems.length;
  summaryItems.forEach((item, i) => {
    const x = margin + i * boxW;
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(x, y, boxW - 2, 16, 2, 2, "F");
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(item.label.toUpperCase(), x + (boxW - 2) / 2, y + 5.5, { align: "center" });
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(item.value, x + (boxW - 2) / 2, y + 12, { align: "center" });
  });

  y += 22;

  // ── Map image ───────────────────────────────────────────────
  if (mapImageBase64) {
    // Draw a subtle border around the map area
    const mapH = 90; // mm — roughly half the remaining page
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, mapH, 2, 2, "S");

    try {
      doc.addImage(mapImageBase64, "PNG", margin + 0.5, y + 0.5, contentW - 1, mapH - 1);
    } catch {
      // If image fails, show a placeholder message
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(margin, y, contentW, mapH, 2, 2, "F");
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Route map unavailable", pageW / 2, y + mapH / 2, { align: "center" });
    }

    // Map caption
    y += mapH + 2;
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");

    // Draw segment colour legend
    const legendItems = route.segments.map((seg, si) => ({
      color: SEGMENT_HEADER_COLORS[si % SEGMENT_HEADER_COLORS.length],
      label: seg.label,
    }));

    let legendX = margin;
    legendItems.forEach((item) => {
      doc.setFillColor(...item.color);
      doc.roundedRect(legendX, y, 4, 3, 0.5, 0.5, "F");
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(7);
      doc.text(item.label, legendX + 5.5, y + 2.5);
      legendX += 5.5 + doc.getTextWidth(item.label) + 8;
    });

    y += 8;
  } else {
    // No map — add a small note
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text("(Map image could not be loaded)", margin, y + 4);
    y += 10;
  }

  // ── Segments / Stop Tables ───────────────────────────────────
  route.segments.forEach((segment, si) => {
    const segRgb = SEGMENT_HEADER_COLORS[si % SEGMENT_HEADER_COLORS.length];
    const isMulti = route.segments.length > 1;

    // New page if not enough space for the segment header + at least a few rows
    if (y > pageH - 50) {
      doc.addPage();
      y = 14;
    }

    // Segment header bar (multi-segment routes only)
    if (isMulti) {
      doc.setFillColor(...segRgb);
      doc.roundedRect(margin, y, contentW, 10, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(segment.label, margin + 3, y + 6.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const segSummary = `${segment.orderedStops.length} stops  ·  ${segment.totalDistanceText}  ·  ${segment.totalDurationText}`;
      doc.text(segSummary, pageW - margin - 3, y + 6.5, { align: "right" });
      y += 13;
    }

    // Build table rows
    const tableRows: (string | number)[][] = [];
    segment.orderedStops.forEach((stop: Stop, localIdx: number) => {
      const leg = segment.legs[localIdx];
      const globalIdx =
        route.segments
          .slice(0, si)
          .reduce((acc, s) => acc + s.orderedStops.length - 1, 0) + localIdx;

      const role =
        stop.role === "origin"
          ? "Origin"
          : stop.role === "destination"
          ? "Destination"
          : "Waypoint";

      const cityState = [stop.city, stop.state].filter(Boolean).join(", ");
      const address = stop.address && stop.address !== stop.name ? stop.address : "";
      const addressLine = [address, cityState].filter(Boolean).join(", ");

      tableRows.push([
        globalIdx + 1,
        stop.name,
        addressLine || "—",
        leg ? leg.distanceText : "—",
        leg ? leg.durationText : "—",
        role,
      ]);
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["#", "Name", "Address", "Distance", "Duration", "Role"]],
      body: tableRows,
      styles: {
        fontSize: 8,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        overflow: "linebreak",
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: isMulti ? segRgb : [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 48 },
        2: { cellWidth: 60 },
        3: { cellWidth: 20, halign: "right" },
        4: { cellWidth: 20, halign: "right" },
        5: { cellWidth: 22, halign: "center" },
      },
      didParseCell: (data) => {
        if (data.section === "body") {
          const role = data.row.cells[5]?.raw as string;
          if (role === "Origin") {
            data.cell.styles.fillColor = [220, 252, 231];
            data.cell.styles.textColor = [21, 128, 61];
          } else if (role === "Destination") {
            data.cell.styles.fillColor = [254, 226, 226];
            data.cell.styles.textColor = [185, 28, 28];
          }
        }
      },
    });

    y = ((doc as unknown) as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  });

  // ── Footer on every page ─────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFillColor(241, 245, 249);
    doc.rect(0, pageH - 10, pageW, 10, "F");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Route Optimizer — Optimised Route Sheet", margin, pageH - 3.5);
    doc.text(`Page ${p} of ${totalPages}`, pageW - margin, pageH - 3.5, { align: "right" });
  }

  // ── Save ─────────────────────────────────────────────────────
  const filename = `route-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}
