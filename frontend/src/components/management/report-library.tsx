import {
  BedDouble,
  CircleDollarSign,
  FileChartColumn,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ReportDefinition } from "@/types/management";

const icons = {
  Operations: BedDouble,
  Revenue: CircleDollarSign,
  Guests: UsersRound,
  Finance: FileChartColumn,
};
export function ReportLibrary({ reports }: { reports: ReportDefinition[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reports.map((report) => {
        const Icon = icons[report.category];
        return (
          <Card key={report.id}>
            <CardContent className="flex h-full flex-col">
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-primary/8 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <Badge variant="outline">{report.category}</Badge>
              </div>
              <h2 className="mt-5 text-base font-semibold">{report.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                {report.description}
              </p>
              <div className="mt-5 border-t pt-4">
                <span className="text-[11px] text-muted-foreground">
                  {report.updatedLabel} · Preview definition
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
