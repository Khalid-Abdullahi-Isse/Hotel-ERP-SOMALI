import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorMessage } from "@/components/shared/error-message";
import { PageHeader } from "@/components/shared/page-header";
import { GuestForm } from "@/components/guests/guest-form";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Add guest" };

export default async function NewGuestPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, PERMISSIONS.guestsCreate))
    return (
      <ErrorMessage
        title="Access restricted"
        message="You do not have permission to create guests."
      />
    );

  return (
    <div className="space-y-7">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/guests">
          <ChevronLeft />
          Back to guests
        </Link>
      </Button>
      <PageHeader
        title="Add guest"
        description="Create a new guest profile. Guests can also be created during reservation booking."
      />
      <GuestForm />
    </div>
  );
}
