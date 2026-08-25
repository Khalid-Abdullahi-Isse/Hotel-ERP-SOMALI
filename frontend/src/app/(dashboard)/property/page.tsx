import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Layers3, Tags } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";

export const metadata: Metadata = { title: "Property Setup" };

const setupAreas = [
  { title: "Floors", description: "Organize rooms by floor and keep property navigation clear.", href: "/floors", icon: Layers3, permission: PERMISSIONS.floorsManage },
  { title: "Room Types", description: "Manage sellable room categories, capacity, and base pricing.", href: "/room-types", icon: Tags, permission: PERMISSIONS.roomTypesManage },
] as const;

export default async function PropertySetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const areas = setupAreas.filter((area) => can(user, area.permission));
  if (areas.length === 0) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <PageHeader title="Property Setup" description="Configure the structure and room inventory rules used across hotel operations." />
      <div className="grid gap-4 md:grid-cols-2">
        {areas.map((area) => {
          const Icon = area.icon;
          return (
            <Card key={area.href} className="shadow-none">
              <CardContent className="flex items-start gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-secondary text-primary"><Icon className="size-5" aria-hidden="true" /></div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{area.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{area.description}</p>
                  <Link href={area.href} className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-primary hover:underline">
                    Manage {area.title.toLowerCase()} <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
