import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/shared/error-message";
import { PageHeader } from "@/components/shared/page-header";
import { GuestForm } from "@/components/guests/guest-form";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getGuestRaw } from "@/services/guest.server";
import { getCurrentUser } from "@/services/auth.server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Edit guest" };

export default async function EditGuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, PERMISSIONS.guestsUpdate))
    return (
      <ErrorMessage
        title="Access restricted"
        message="You do not have permission to edit guests."
      />
    );

  const guest = await getGuestRaw(id);
  if (!guest) notFound();

  return (
    <div className="space-y-7">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href={`/guests/${guest.id}`}>
          <ChevronLeft />
          Back to guest
        </Link>
      </Button>
      <PageHeader
        title={`Edit ${guest.fullName}`}
        description="Update guest profile information."
      />
      <GuestForm guest={guest} />
    </div>
  );
}
