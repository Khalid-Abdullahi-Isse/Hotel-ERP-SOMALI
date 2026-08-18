import type { Metadata } from "next";
import { ExpensesTable } from "@/components/finance/expenses-table";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { getExpenses } from "@/services/finance.server";

export const metadata: Metadata = { title: "Expenses" };
export default async function ExpensesPage() {
  const expenses = await getExpenses();
  return <div className="space-y-6"><PageHeader title="Expenses" description="Review saved expense records and reversals." /><Card className="py-0"><ExpensesTable expenses={expenses} /></Card></div>;
}
