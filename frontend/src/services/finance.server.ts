import "server-only";

import { serverApi } from "@/lib/server-api";
import type { ApiExpense, ApiPayment } from "@/types/api-contracts";
import type { CurrencyCode, ExpenseRecord, PaymentMethod, PaymentRecord } from "@/types/finance";

function paymentMethod(name: string): PaymentMethod {
  const value = name.toLowerCase();
  if (value.includes("cash")) return "cash";
  if (value.includes("mobile") || value.includes("evc") || value.includes("zaad")) return "mobile_money";
  return "bank";
}

export async function getPayments(): Promise<PaymentRecord[]> {
  const values = await serverApi<ApiPayment[]>("/payments");
  return values.map((payment) => ({
    id: payment.id,
    reference: payment.reference || payment.id.slice(0, 8).toUpperCase(),
    date: payment.paidAt,
    guestName: payment.guest?.fullName ?? "Unassigned guest",
    bookingId: payment.reservation?.bookingNumber ?? "—",
    method: paymentMethod(payment.paymentMethod.name),
    amount: Number(payment.amount),
    currency: payment.hotel.currencyCode,
    status: payment.status === "VOIDED" ? "failed" : payment.kind === "REFUND" ? "refunded" : "completed",
  }));
}

export async function getExpenses(): Promise<ExpenseRecord[]> {
  const values = await serverApi<ApiExpense[]>("/expenses");
  return values.map((expense) => ({
    id: expense.id,
    reference: expense.reference || expense.id.slice(0, 8).toUpperCase(),
    date: expense.expenseDate,
    category: expense.category.name,
    vendor: expense.createdBy.fullName,
    description: expense.description,
    amount: Number(expense.amount),
    currency: expense.hotel.currencyCode,
    status: expense.reversed ? "rejected" : "approved",
  }));
}

interface ReportEnvelope<T> { currencyCode: CurrencyCode; data: T[] }
export async function getReportSummary(from: string, to: string) {
  const query = new URLSearchParams({ from, to });
  const [revenue, expenses, occupancy, reservations, payments, outstanding] = await Promise.all([
    serverApi<ReportEnvelope<{ revenue: string }>>(`/reports/revenue?${query}`),
    serverApi<ReportEnvelope<{ amount: string }>>(`/reports/expenses?${query}`),
    serverApi<ReportEnvelope<{ occupancyRate: string }>>(`/reports/occupancy?${query}`),
    serverApi<ReportEnvelope<{ status: string; count: number }>>(`/reports/reservations?${query}`),
    serverApi<ReportEnvelope<{ amount: string; count: number }>>(`/reports/payments?${query}`),
    serverApi<ReportEnvelope<{ outstandingAmount: string }>>("/reports/outstanding-balances"),
  ]);
  const sum = <T,>(items: T[], value: (item: T) => number) => items.reduce((total, item) => total + value(item), 0);
  return {
    currency: revenue.currencyCode,
    revenue: sum(revenue.data, (item) => Number(item.revenue)),
    expenses: sum(expenses.data, (item) => Number(item.amount)),
    occupancy: occupancy.data.length ? sum(occupancy.data, (item) => Number(item.occupancyRate)) / occupancy.data.length : 0,
    reservations: sum(reservations.data, (item) => item.count),
    payments: sum(payments.data, (item) => item.count),
    outstanding: sum(outstanding.data, (item) => Number(item.outstandingAmount)),
  };
}
