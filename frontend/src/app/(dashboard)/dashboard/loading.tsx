import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard">
      <div className="space-y-2"><Skeleton className="h-8 w-40" /><Skeleton className="h-4 w-64" /></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]"><Skeleton className="h-[390px] rounded-xl" /><Skeleton className="h-[390px] rounded-xl" /></div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]"><Skeleton className="h-[300px] rounded-xl" /><Skeleton className="h-[300px] rounded-xl" /></div>
    </div>
  );
}
