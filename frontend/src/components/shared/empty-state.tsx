import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: LucideIcon; title: string; description: string; action?: ReactNode;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
