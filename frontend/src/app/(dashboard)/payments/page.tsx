import type { Metadata } from "next";
import { PaymentsTable } from "@/components/finance/payments-table";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { getPayments } from "@/services/finance.server";

export const metadata: Metadata = { title: "Payments" };
export default async function PaymentsPage() {
  const payments = await getPayments();
  return <div className="space-y-6"><PageHeader title="Payments" description="Review saved payment and refund records." /><Card className="py-0"><PaymentsTable payments={payments} /></Card></div>;
}
