import { Skeleton } from "@/components/ui/skeleton";

export default function AccountingLoading() {
  return <div className="space-y-6" aria-label="Loading accounting"><div className="space-y-2"><Skeleton className="h-9 w-56" /><Skeleton className="h-5 w-full max-w-xl" /></div><div className="flex gap-2 overflow-hidden">{Array.from({ length: 7 }, (_, index) => <Skeleton className="h-9 w-28 shrink-0" key={index} />)}</div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton className="h-28 rounded-xl" key={index} />)}</div><Skeleton className="h-96 rounded-xl" /></div>;
}
