import type { Metadata } from "next";
import { BookOpenText, CircleHelp, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Help & Support" };

const helpAreas = [
  { title: "Operating Hudheel", description: "Use Front Desk for arrivals, departures, room assignment, and active stays.", icon: BookOpenText },
  { title: "Access and permissions", description: "If a destination is unavailable, ask an administrator to review your role permissions.", icon: ShieldCheck },
  { title: "Technical support", description: "When reporting a problem, include the page, time, and action that could not be completed.", icon: CircleHelp },
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Help & Support" description="Practical guidance for completing hotel work and getting assistance." />
      <Card className="max-w-3xl shadow-none">
        <CardContent className="divide-y divide-outline-variant p-0">
          {helpAreas.map((area) => {
            const Icon = area.icon;
            return (
              <section key={area.title} className="flex gap-4 px-5 py-5 sm:px-6">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <div><h2 className="font-semibold">{area.title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{area.description}</p></div>
              </section>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
