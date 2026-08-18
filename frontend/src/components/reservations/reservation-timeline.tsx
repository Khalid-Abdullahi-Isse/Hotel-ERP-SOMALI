import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TimelineRoom } from "@/types/timeline";

const bookingStyles = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  confirmed: "border-violet-200 bg-violet-50 text-violet-800",
  checked_in: "border-emerald-200 bg-emerald-50 text-emerald-800",
  checked_out: "border-slate-200 bg-slate-50 text-slate-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-800",
  no_show: "border-red-300 bg-red-50 text-red-900",
};

export function ReservationTimeline({
  rooms,
  dates,
  dateLabel,
}: {
  rooms: TimelineRoom[];
  dates: Array<{ weekday: string; date: string }>;
  dateLabel: string;
}) {
  return (
    <Card className="py-0">
      <CardHeader className="flex flex-col gap-4 border-b py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Reservation calendar</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {dateLabel}
          </p>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <div
              className="grid border-b bg-muted/35"
              style={{
                gridTemplateColumns: "160px repeat(7,minmax(120px,1fr))",
              }}
            >
              <div className="border-r px-4 py-3 text-xs font-medium text-muted-foreground">
                Room
              </div>
              {dates.map((day, index) => (
                <div
                  key={day.date}
                  className={cn(
                    "border-r px-3 py-2 text-center last:border-r-0",
                    index === 0 && "bg-primary/5",
                  )}
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {day.weekday}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-sm font-semibold",
                      index === 0 && "text-primary",
                    )}
                  >
                    {day.date}
                  </p>
                </div>
              ))}
            </div>
            {rooms.map((room) => (
              <div
                key={room.roomNumber}
                className="grid min-h-20 border-b last:border-b-0"
                style={{
                  gridTemplateColumns: "160px repeat(7,minmax(120px,1fr))",
                }}
              >
                <div className="border-r px-4 py-3">
                  <p className="font-medium">{room.roomNumber}</p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">
                    {room.roomType} · {room.floor}
                  </p>
                </div>
                <div className="relative col-span-7 grid grid-cols-7">
                  <div className="absolute inset-0 grid grid-cols-7">
                    {dates.map((day, index) => (
                      <div
                        key={day.date}
                        className={cn(
                          "border-r last:border-r-0",
                          index === 0 && "bg-primary/[0.025]",
                        )}
                      />
                    ))}
                  </div>
                  {room.bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className={cn(
                        "relative z-10 m-1.5 min-w-0 rounded-md border px-2.5 py-2 text-left shadow-sm",
                        bookingStyles[booking.status],
                      )}
                      style={{
                        gridColumn: `${booking.startDay} / span ${booking.span}`,
                      }}
                    >
                      <p className="truncate text-xs font-semibold">
                        {booking.guestName}
                      </p>
                      <p className="mt-1 truncate text-[10px] opacity-75">
                        {booking.source} · {booking.span} night
                        {booking.span === 1 ? "" : "s"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t px-4 py-3 text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Status:</span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            Checked in
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-violet-500" />
            Confirmed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" />
            Pending
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
