import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { getCurrentHotel } from "@/services/system.server";

export const metadata: Metadata = { title: "Settings" };
export default async function SettingsPage() { const hotel = await getCurrentHotel(); return <div className="space-y-6"><PageHeader title="Settings" description="Property, localization, payments, and notification preferences." /><SettingsPanel hotel={hotel} /></div>; }
