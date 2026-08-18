import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { FrontDeskSummary } from "@/components/front-desk/front-desk-summary";
import { RoomBoard } from "@/components/front-desk/room-board";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getFrontDeskData } from "@/services/front-desk.server";

export const metadata: Metadata = { title: "Front Desk" };
export default async function FrontDeskPage() {
  const { rooms, metrics } = await getFrontDeskData();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Front Desk"
        description="Manage room assignments and stays using standard saved records."
        actions={<Button asChild><Link href="/reservations/new"><Plus />New reservation</Link></Button>}
      />
      <FrontDeskSummary metrics={metrics} />
      <Card className="py-0"><RoomBoard rooms={rooms} /></Card>
    </div>
  );
}
