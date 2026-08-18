import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BookingSource } from "@/types/dashboard";

export function BookingSources({ sources }: { sources: BookingSource[] }) {
  return (
    <Card>
      <CardHeader className="border-b"><CardTitle>Booking sources</CardTitle><p className="text-xs text-muted-foreground">Reservations this month</p></CardHeader>
      <CardContent className="space-y-4">
        {sources.map((source) => <div key={source.label}><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-medium">{source.label}</span><span className="tabular-nums text-muted-foreground">{source.value}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${source.color}`} style={{ width: `${source.value}%` }} /></div></div>)}
      </CardContent>
    </Card>
  );
}
