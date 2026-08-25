import { Skeleton } from "@/components/ui/skeleton";
export default function StayLoading() { return <div className="space-y-5" aria-label="Loading stay"><Skeleton className="h-10 w-72" /><div className="grid gap-5 xl:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div></div>; }
