import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, UserPlus, UserRoundCheck } from "lucide-react";
import { GuestsTable } from "@/components/guests/guests-table";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getGuests } from "@/services/guest.server";
import { getCurrentUser } from "@/services/auth.server";
import { Pagination } from "@/components/shared/pagination";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { can } from "@/lib/permissions";
import { PERMISSIONS } from "@/constants/permissions";
import { parsePage } from "@/lib/pagination";
import { Suspense } from "react";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Guests" };
export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const [guests, user] = await Promise.all([
    getGuests({ page, limit: 30, search: params.search }),
    getCurrentUser(),
  ]);
  const selectingForReservation =
    params.mode === "reservation" &&
    Boolean(user && can(user, PERMISSIONS.reservationsCreate));
  if (guests.pagination.totalPages > 0 && page > guests.pagination.totalPages) {
    const query = new URLSearchParams({
      page: String(guests.pagination.totalPages),
    });
    if (params.search) query.set("search", params.search);
    if (selectingForReservation) query.set("mode", "reservation");
    redirect(`/guests?${query}`);
  }
  const canCreate = Boolean(user && can(user, PERMISSIONS.guestsCreate));
  return (
    <div className="space-y-6">
      <PageHeader
        title={selectingForReservation ? "Find an existing guest" : "Guests"}
        description={
          selectingForReservation
            ? "Search by name, phone, email, or guest ID, then select the matching profile."
            : "Guest profiles, contact details, stay history, and service notes."
        }
        actions={
          selectingForReservation ? (
            <Button asChild variant="outline">
              <Link href="/front-desk">
                <ArrowLeft />
                Back to Front Desk
              </Link>
            </Button>
          ) : canCreate ? (
            <Button asChild>
              <Link href="/guests/new">
                <UserPlus />
                New guest
              </Link>
            </Button>
          ) : undefined
        }
      />
      {selectingForReservation ? (
        <Alert className="border-primary/20 bg-primary/5 px-4 py-3">
          <UserRoundCheck className="text-primary" />
          <AlertTitle>Use the existing guest account</AlertTitle>
          <AlertDescription>
            Selecting a guest starts a prefilled reservation and avoids creating
            a duplicate profile.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card className="py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Guest directory</CardTitle>
          <p className="text-xs text-muted-foreground">
            Sensitive identity information is hidden from this operational view
          </p>
        </CardHeader>
        <Suspense fallback={<div className="h-17 border-b" />}>
          <ListToolbar placeholder="Search name, phone, email, or ID" />
        </Suspense>
        <GuestsTable
          guests={guests.data}
          selectionMode={selectingForReservation}
        />
        <Pagination
          {...guests.pagination}
          itemLabel="guests"
          searchParams={{
            search: params.search,
            mode: selectingForReservation ? "reservation" : undefined,
          }}
        />
      </Card>
    </div>
  );
}
