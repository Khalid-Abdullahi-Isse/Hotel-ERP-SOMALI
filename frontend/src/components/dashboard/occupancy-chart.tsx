import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OccupancyPoint } from "@/types/dashboard";

function chartCoordinates(points: OccupancyPoint[]) {
  const width = 600;
  const height = 170;
  const xStep = width / Math.max(points.length - 1, 1);
  return points.map((point, index) => ({ x: index * xStep, y: height - ((point.value - 50) / 50) * height }));
}

export function OccupancyChart({ points }: { points: OccupancyPoint[] }) {
  const coordinates = chartCoordinates(points);
  const line = coordinates.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const area = `${line} L600,170 L0,170 Z`;

  return (
    <Card>
      <CardHeader className="grid grid-cols-[1fr_auto] border-b"><div><CardTitle>Occupancy</CardTitle><p className="mt-1 text-xs text-muted-foreground">Last 7 days</p></div><div className="text-right"><p className="text-lg font-semibold text-primary">82%</p><p className="text-[10px] text-muted-foreground">Today</p></div></CardHeader>
      <CardContent>
        <div className="relative h-[190px] w-full" role="img" aria-label={`Occupancy ranged from ${Math.min(...points.map((point) => point.value))}% to ${Math.max(...points.map((point) => point.value))}% over seven days`}>
          <div className="absolute inset-x-0 top-0 flex h-[170px] flex-col justify-between text-[10px] text-muted-foreground"><span>100%</span><span>75%</span><span>50%</span></div>
          <svg viewBox="0 0 600 170" preserveAspectRatio="none" className="absolute inset-x-8 top-0 h-[170px] w-[calc(100%-2rem)] overflow-visible" aria-hidden="true">
            <defs><linearGradient id="occupancy-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand-blue)" stopOpacity="0.22" /><stop offset="100%" stopColor="var(--brand-blue)" stopOpacity="0" /></linearGradient></defs>
            <path d={area} fill="url(#occupancy-fill)" /><path d={line} fill="none" stroke="var(--brand-blue)" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            {coordinates.map((point, index) => <circle key={points[index].label} cx={point.x} cy={point.y} r="4" fill="white" stroke="var(--brand-blue)" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
          </svg>
          <div className="absolute inset-x-8 bottom-0 flex justify-between text-[10px] text-muted-foreground">{points.map((point) => <span key={point.label}>{point.label}</span>)}</div>
        </div>
      </CardContent>
    </Card>
  );
}
