import type { Metadata } from "next";
import { ExpensesTable } from "@/components/finance/expenses-table";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { getExpenses } from "@/services/finance.server";
import { Pagination } from "@/components/shared/pagination";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { parsePage } from "@/lib/pagination";
import { Suspense } from "react";
import { redirectOutOfRangePage } from "@/lib/pagination.server";

export const metadata: Metadata = { title: "Expenses" };
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const params = await searchParams; const expenses = await getExpenses({ page: parsePage(params.page), search: params.search });
  redirectOutOfRangePage(parsePage(params.page), expenses.pagination.totalPages, "/expenses", params);
  return <div className="space-y-6"><PageHeader title="Expenses" description="Review saved expense records and reversals." /><Card className="py-0"><Suspense fallback={<div className="h-17 border-b" />}><ListToolbar placeholder="Search reference, description, category, or user" /></Suspense><ExpensesTable expenses={expenses.data} /><Pagination {...expenses.pagination} itemLabel="expenses" searchParams={{ search: params.search }} /></Card></div>;
}
