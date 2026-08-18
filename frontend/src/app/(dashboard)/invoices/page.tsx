import type { Metadata } from "next";
import { InvoicesTable } from "@/components/finance/invoices-table";
import { PageHeader } from "@/components/shared/page-header";
import { getInvoices } from "@/services/catalog.server";

export const metadata: Metadata = { title: "Invoices" };
export default async function InvoicesPage() {
  const invoices = await getInvoices();
  return <div className="space-y-6"><PageHeader title="Invoices" description="Review issued invoices, payments received, and outstanding balances." /><InvoicesTable invoices={invoices} /></div>;
}
