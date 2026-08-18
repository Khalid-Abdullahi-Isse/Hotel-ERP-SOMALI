import type { Metadata } from "next";
import { GuestsTable } from "@/components/guests/guests-table";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getGuests } from "@/services/guest.server";

export const metadata: Metadata = { title: "Guests" };
export default async function GuestsPage() { const guests = await getGuests({ page: 1, pageSize: 25 }); return <div className="space-y-6"><PageHeader title="Guests" description="Guest profiles, contact details, stay history, and service notes." /><Card className="py-0"><CardHeader className="border-b py-4"><CardTitle>Guest directory</CardTitle><p className="text-xs text-muted-foreground">Sensitive identity information is hidden from this operational view</p></CardHeader><GuestsTable guests={guests.data} /></Card></div>; }
