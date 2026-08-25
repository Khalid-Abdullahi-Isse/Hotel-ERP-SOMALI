import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CheckInLoading() {
  return <div className="mx-auto max-w-4xl space-y-5" aria-label="Loading reservation"><Card><CardContent className="flex gap-3 py-5">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-7 flex-1" />)}</CardContent></Card><Card><CardContent className="space-y-5 py-7"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-80 max-w-full" /><div className="grid gap-5 rounded-lg border p-5 sm:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-10" />)}</div><Skeleton className="ml-auto h-9 w-28" /></CardContent></Card></div>;
}
