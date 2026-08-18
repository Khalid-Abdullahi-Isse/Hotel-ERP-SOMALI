import { BedDouble } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <BedDouble className="size-5" aria-hidden="true" />
      </div>
      {compact ? null : (
        <div className="leading-tight">
          <p className="font-semibold tracking-tight">Hudheel</p>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Hotel ERP</p>
        </div>
      )}
    </div>
  );
}
