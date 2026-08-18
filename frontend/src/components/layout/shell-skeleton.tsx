import { Skeleton } from "@/components/ui/skeleton";
export function ShellSkeleton() {
  return <div className="min-h-dvh bg-muted/30 lg:grid lg:grid-cols-[248px_1fr]"><aside className="hidden border-r bg-background p-5 lg:block"><Skeleton className="h-10 w-32" /><div className="mt-10 space-y-3">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}</div></aside><div><div className="h-16 border-b bg-background" /><main className="p-8"><Skeleton className="h-9 w-48" /><Skeleton className="mt-3 h-5 w-80" /><Skeleton className="mt-8 h-72 w-full" /></main></div></div>;
}
