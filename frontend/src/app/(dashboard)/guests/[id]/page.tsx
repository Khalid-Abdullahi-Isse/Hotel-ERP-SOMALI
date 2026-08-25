import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { GuestProfile } from "@/components/guests/guest-profile";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getGuest } from "@/services/guest.server";
import { getCurrentUser } from "@/services/auth.server";
import { can } from "@/lib/permissions";
import { PERMISSIONS } from "@/constants/permissions";

export const metadata: Metadata = { title: "Guest Profile" };
export default async function GuestProfilePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const [guest, user] = await Promise.all([getGuest(id), getCurrentUser()]); if (!guest) notFound(); const canCreateReservation = Boolean(user && can(user, PERMISSIONS.reservationsCreate)); return <div className="space-y-6"><Button asChild variant="ghost" size="sm" className="-ml-2"><Link href="/guests"><ArrowLeft />Back to guests</Link></Button><PageHeader title={guest.name} description="Guest profile, current booking, previous stays, and service notes." actions={canCreateReservation ? <Button asChild><Link href={`/reservations/new?guestId=${encodeURIComponent(guest.id)}`}><CalendarPlus />New reservation</Link></Button> : null} /><GuestProfile guest={guest} /></div>; }
