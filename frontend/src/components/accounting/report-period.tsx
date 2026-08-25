import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReportPeriod({
  dateFrom,
  dateTo,
  showFrom = true,
}: {
  dateFrom: string;
  dateTo: string;
  showFrom?: boolean;
}) {
  return (
    <form className="flex flex-wrap items-end gap-3" method="get">
      {showFrom ? (
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          From
          <Input name="dateFrom" type="date" defaultValue={dateFrom} />
        </label>
      ) : null}
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">
        {showFrom ? "To" : "As of"}
        <Input name="dateTo" type="date" defaultValue={dateTo} />
      </label>
      <Button type="submit" variant="outline">
        Apply period
      </Button>
    </form>
  );
}
