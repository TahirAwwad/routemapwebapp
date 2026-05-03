// ============================================================
// BottomActionBar — Sticky bottom bar for route actions
// Shows selected count and primary actions (Add all / Optimise)
// ============================================================

import { type RouteResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BottomActionBarProps {
  /** Number of currently selected leads */
  selectedCount: number;
  /** Whether the optimise CTA should be enabled */
  canOptimise: boolean;
  /** Total number of filtered leads */
  filteredCount: number;
  /** Callback when user clicks "Add all leads" */
  onAddAll: () => void;
  /** Callback when user clicks "Optimise route" */
  onOptimise: () => void;
  /** Optional CSS class override */
  className?: string;
}

export function BottomActionBar({
  selectedCount,
  canOptimise,
  filteredCount,
  onAddAll,
  onOptimise,
  className,
}: BottomActionBarProps) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-md px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className
      )}
    >
      <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground shrink-0">
          <span className="font-mono font-semibold text-foreground">{selectedCount}</span>{" "}
          selected
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 px-4"
            disabled={filteredCount === 0}
            onClick={onAddAll}
          >
            Add all leads
          </Button>
          <Button
            className="min-h-11 px-6 font-semibold"
            disabled={!canOptimise}
            onClick={onOptimise}
          >
            Optimise route
          </Button>
        </div>
      </div>
    </div>
  );
}