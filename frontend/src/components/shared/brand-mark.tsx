import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-primary-foreground" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-5" fill="none">
          <path d="M6.5 5.5v13M17.5 5.5v13M6.5 12h11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <path d="M9 8.25h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".72" />
        </svg>
      </div>
      {compact ? null : (
        <div className="leading-tight">
          <p className="text-base font-semibold tracking-tight">Hudheel</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Hotel ERP</p>
        </div>
      )}
    </div>
  );
}
