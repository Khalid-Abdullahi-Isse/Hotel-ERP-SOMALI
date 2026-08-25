import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return <div className="space-y-6" aria-label="Loading administration"><div className="space-y-2"><Skeleton className="h-9 w-72" /><Skeleton className="h-5 w-[32rem] max-w-full" /></div><Skeleton className="h-16 w-full" /><Skeleton className="h-[28rem] w-full" /></div>;
}
