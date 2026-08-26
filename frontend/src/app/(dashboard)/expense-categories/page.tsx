import type { Metadata } from "next";
import { ExpenseCategoryManager } from "@/components/accounting/expense-category-manager";
import { PageHeader } from "@/components/shared/page-header";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { getAccountingAccounts, getAccountingSettings } from "@/services/accounting.server";
import { getCurrentUser } from "@/services/auth.server";
import { getExpenseCategories } from "@/services/finance.server";

export const metadata: Metadata = { title: "Expense Categories" };
export default async function ExpenseCategoriesPage() {
  const [categories, settings, user] = await Promise.all([getExpenseCategories(), getAccountingSettings(), getCurrentUser()]);
  const accounts = settings && user && can(user, PERMISSIONS.chartOfAccountsRead) ? (await getAccountingAccounts({ page: 1, limit: 100, type: "EXPENSE", isActive: "true" })).data : [];
  return <div className="space-y-6"><PageHeader title="Expense Categories" description="Classify expenses and map each category to its automatic ledger account." /><ExpenseCategoryManager categories={categories} accounts={accounts} canManage={Boolean(user && can(user, PERMISSIONS.expenseCategoriesManage))} /></div>;
}
