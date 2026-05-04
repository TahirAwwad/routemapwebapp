import { useCallback, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";

type SplitScreenProps = {
  topPanel: React.ReactNode;
  bottomPanel: React.ReactNode;
  initialSplit?: number; // 0-100, default 50
  minTop?: number; // min height in px, default 120
  minBottom?: number; // min height in px, default 120
  className?: string;
  dividerClassName?: string;
};

export function SplitScreen({
  topPanel,
  bottomPanel,
  initialSplit = 50,
  minTop = 120,
  minBottom = 120,
  className,
  dividerClassName,
}: SplitScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPct, setSplitPct] = useState(initialSplit);
  const dragging = useRef(false);
  const startYRef = useRef(0);
  const startSplitRef = useRef(0);

  const onDividerPointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    startYRef.current = e.clientY;
    startSplitRef.current = splitPct;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [splitPct]);

  const onDividerPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const totalH = rect.height;
    if (totalH <= 0) return;

    const dy = e.clientY - startYRef.current;
    const dPct = (dy / totalH) * 100;
    const raw = startSplitRef.current + dPct;

    // Convert min constraints to percentages
    const minTopPct = (minTop / totalH) * 100;
    const minBottomPct = (minBottom / totalH) * 100;
    const maxTopPct = 100 - minBottomPct;

    const next = Math.max(minTopPct, Math.min(maxTopPct, raw));
    setSplitPct(next);
  }, [minTop, minBottom]);

  const onDividerPointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div ref={containerRef} className={cn("flex flex-col flex-1 min-h-0 w-full", className)}>
      {/* Top panel */}
      <div
        className="shrink-0 overflow-hidden"
        style={{ height: `${splitPct}%` }}
      >
        {topPanel}
      </div>

      {/* Draggable divider */}
      <div
        className={cn(
          "shrink-0 h-2 cursor-row-resize flex items-center justify-center group",
          dividerClassName
        )}
        onPointerDown={onDividerPointerDown}
        onPointerMove={onDividerPointerMove}
        onPointerUp={onDividerPointerUp}
        onPointerCancel={onDividerPointerUp}
      >
        <div className="w-8 h-1 rounded-full bg-border group-hover:bg-primary transition-colors" />
      </div>

      {/* Bottom panel */}
      <div
        className="overflow-y-auto"
        style={{ height: `${100 - splitPct}%` }}
      >
        {bottomPanel}
      </div>
    </div>
  );
}