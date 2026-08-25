import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] font-semibold leading-9 tracking-[-0.02em] text-foreground sm:text-[30px]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-on-surface-variant">{description}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap items-center gap-2 max-sm:[&>a]:w-full max-sm:[&>button]:w-full sm:w-auto sm:shrink-0 sm:justify-end">{actions}</div> : null}
    </header>
  );
}
