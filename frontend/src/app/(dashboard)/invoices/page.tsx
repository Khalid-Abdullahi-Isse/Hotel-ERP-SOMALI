import type { Metadata } from "next";
import { InvoicesTable } from "@/components/finance/invoices-table";
import { PageHeader } from "@/components/shared/page-header";
import { getInvoices } from "@/services/catalog.server";
import { Pagination } from "@/components/shared/pagination";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { parsePage } from "@/lib/pagination";
import { Suspense } from "react";
import { redirectOutOfRangePage } from "@/lib/pagination.server";

export const metadata: Metadata = { title: "Invoices" };
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string; status?: string }> }) {
  const params = await searchParams; const invoices = await getInvoices({ page: parsePage(params.page), search: params.search, status: params.status });
  redirectOutOfRangePage(parsePage(params.page), invoices.pagination.totalPages, "/invoices", params);
  return <div className="space-y-6"><PageHeader title="Invoices" description="Review issued invoices, payments received, and outstanding balances." /><div><Suspense fallback={<div className="h-17 border" />}><ListToolbar placeholder="Search invoice, booking, or guest" statuses={[{ value: "issued", label: "Issued" }, { value: "partially_paid", label: "Partially paid" }, { value: "paid", label: "Paid" }, { value: "voided", label: "Voided" }]} /></Suspense><InvoicesTable invoices={invoices.data} /><Pagination {...invoices.pagination} itemLabel="invoices" searchParams={{ search: params.search, status: params.status }} /></div></div>;
}
