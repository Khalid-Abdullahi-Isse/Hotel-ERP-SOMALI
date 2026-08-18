import type { Metadata } from "next";
import { InvoicesTable } from "@/components/finance/invoices-table";
import { MetricGrid } from "@/components/shared/metric-grid";
import { PageHeader } from "@/components/shared/page-header";
import { getInvoices } from "@/services/catalog.server";
import { getExpenses, getPayments } from "@/services/finance.server";
import type { FinanceMetric } from "@/types/finance";

export const metadata: Metadata = { title: "Accounting" };
export default async function AccountingPage() {
  const [payments, expenses, invoices] = await Promise.all([getPayments(), getExpenses(), getInvoices()]);
  const received = payments.filter((item) => item.status === "completed").reduce((sum, item) => sum + item.amount, 0);
  const refunded = payments.filter((item) => item.status === "refunded").reduce((sum, item) => sum + item.amount, 0);
  const spent = expenses.filter((item) => item.status === "approved").reduce((sum, item) => sum + item.amount, 0);
  const outstanding = invoices.reduce((sum, item) => sum + Number(item.outstandingAmount), 0);
  const currency = payments[0]?.currency ?? expenses[0]?.currency ?? "USD";
  const metrics: FinanceMetric[] = [
    { label: "Payments received", value: received, currency, detail: "saved transactions", tone: "success" },
    { label: "Refunds", value: refunded, currency, detail: "saved refunds", tone: "warning" },
    { label: "Expenses", value: spent, currency, detail: "excluding reversals", tone: "warning" },
    { label: "Outstanding", value: outstanding, currency, detail: "open invoice balance" },
  ];
  return <div className="space-y-6"><PageHeader title="Accounting" description="Financial records loaded with standard HTTP requests." /><MetricGrid metrics={metrics} /><InvoicesTable invoices={invoices} /></div>;
}
