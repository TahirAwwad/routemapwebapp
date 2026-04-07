// ============================================================
// CSVUpload — CSV file upload and parsing
// Expected columns: Name, State, Address, City, Long&Lati
// "Long&Lati" column: "lat, lng" combined string
// ============================================================

import { useRef, useState } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoute } from "@/contexts/RouteContext";
import { parseCSV } from "@/lib/routeOptimizer";
import { cn } from "@/lib/utils";

export function CSVUpload() {
  const { loadFromCSV } = useRoute();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function processFile(file: File) {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setStatus({ type: "error", message: "Please upload a .csv file." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const stops = parseCSV(text);
        loadFromCSV(stops);
        setStatus({
          type: "success",
          message: `${stops.length} stops loaded. First stop set as origin, last as destination.`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to parse CSV.";
        setStatus({ type: "error", message: msg });
      }
    };
    reader.readAsText(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so same file can be re-uploaded
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-secondary/30"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <Upload className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Drop your CSV file here
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              or click to browse
            </p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Status message */}
      {status && (
        <div
          className={cn(
            "flex items-start gap-2 p-3 rounded-lg text-sm",
            status.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          )}
        >
          {status.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          <p>{status.message}</p>
        </div>
      )}

      {/* Format guide */}
      <div className="bg-secondary/50 rounded-lg p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Expected CSV Format
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b border-border">
                {["Name", "State", "Address", "City", "Long&Lati"].map((h) => (
                  <th
                    key={h}
                    className="text-left py-1 pr-3 font-semibold text-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 pr-3 text-muted-foreground font-mono text-xs">
                  HAIR GLOBAL
                </td>
                <td className="py-1 pr-3 text-muted-foreground font-mono text-xs">
                  TN
                </td>
                <td className="py-1 pr-3 text-muted-foreground font-mono text-xs">
                  2619 MURFREESBORO...
                </td>
                <td className="py-1 pr-3 text-muted-foreground font-mono text-xs">
                  NASHVILLE
                </td>
                <td className="py-1 pr-3 text-muted-foreground font-mono text-xs">
                  36.0725, -86.6382
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          The <span className="font-semibold">Long&amp;Lati</span> column must contain{" "}
          <span className="font-mono">latitude, longitude</span> as a single value.
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-3.5 h-3.5 mr-1.5" />
        Choose CSV File
      </Button>
    </div>
  );
}
