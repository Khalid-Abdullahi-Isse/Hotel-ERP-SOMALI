import type { Metadata } from "next";
import { PaymentsTable } from "@/components/finance/payments-table";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { getPayments } from "@/services/finance.server";
import { Pagination } from "@/components/shared/pagination";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { parsePage } from "@/lib/pagination";
import { Suspense } from "react";
import { redirectOutOfRangePage } from "@/lib/pagination.server";

export const metadata: Metadata = { title: "Payments" };
export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; status?: string }> }) {
  const params = await searchParams; const payments = await getPayments({ page: parsePage(params.page), search: params.search, status: params.status });
  redirectOutOfRangePage(parsePage(params.page), payments.pagination.totalPages, "/payments", params);
  return <div className="space-y-6"><PageHeader title="Payments" description="Review saved payment and refund records." /><Card className="py-0"><Suspense fallback={<div className="h-17 border-b" />}><ListToolbar placeholder="Search reference, guest, booking, or method" statuses={[{ value: "completed", label: "Completed" }, { value: "voided", label: "Voided" }]} /></Suspense><PaymentsTable payments={payments.data} /><Pagination {...payments.pagination} itemLabel="transactions" searchParams={{ search: params.search, status: params.status }} /></Card></div>;
}
