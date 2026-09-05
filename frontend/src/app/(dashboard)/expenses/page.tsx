import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExpensesTable, type ExpensePermissions } from "@/components/finance/expenses-table";
import { ExpenseForm } from "@/components/finance/expense-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/services/auth.server";
import { getExpenses, getExpenseCategories } from "@/services/finance.server";
import { getPaymentMethods } from "@/services/catalog.server";
import { Pagination } from "@/components/shared/pagination";
import { ListToolbar } from "@/components/shared/list-toolbar";
import { parsePage } from "@/lib/pagination";
import { Suspense } from "react";
import { redirectOutOfRangePage } from "@/lib/pagination.server";

export const metadata: Metadata = { title: "Expenses" };
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user, PERMISSIONS.expensesRead)) redirect("/403");
  const params = await searchParams; const expenses = await getExpenses({ page: parsePage(params.page), search: params.search });
  redirectOutOfRangePage(parsePage(params.page), expenses.pagination.totalPages, "/expenses", params);
  const permissions: ExpensePermissions = {
    canSubmit: can(user, PERMISSIONS.expensesCreate),
    canApprove: can(user, PERMISSIONS.expensesApprove),
    canReject: can(user, PERMISSIONS.expensesReject),
    canPay: can(user, PERMISSIONS.expensesPay),
    canReverse: can(user, PERMISSIONS.expensesReverse),
  };
  const canCreate = can(user, PERMISSIONS.expensesCreate);
  const [categories, paymentMethods] = canCreate
    ? await Promise.all([getExpenseCategories(), getPaymentMethods()])
    : [[], []];
  return <div className="space-y-6"><PageHeader title="Expenses" description="Review saved expense records and the approval workflow." actions={canCreate ? <ExpenseForm categories={categories} paymentMethods={paymentMethods} /> : undefined} /><Card className="py-0"><Suspense fallback={<div className="h-17 border-b" />}><ListToolbar placeholder="Search reference, description, category, or user" /></Suspense><ExpensesTable expenses={expenses.data} permissions={permissions} /><Pagination {...expenses.pagination} itemLabel="expenses" searchParams={{ search: params.search }} /></Card></div>;
}
