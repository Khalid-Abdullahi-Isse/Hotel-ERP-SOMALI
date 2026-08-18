export type CurrencyCode = "USD" | "SOS";
export type PaymentMethod = "cash" | "bank" | "mobile_money";
export type TransactionStatus = "completed" | "pending" | "failed" | "refunded";

export interface FinanceMetric { label: string; value: number; currency: CurrencyCode; detail: string; tone?: "default" | "success" | "warning" }
export interface PaymentRecord {
  id: string; reference: string; date: string; guestName: string; bookingId: string;
  method: PaymentMethod; amount: number; currency: CurrencyCode; status: TransactionStatus;
}
export interface ExpenseRecord {
  id: string; reference: string; date: string; category: string; vendor: string;
  description: string; amount: number; currency: CurrencyCode; status: "approved" | "pending" | "rejected";
}
export interface OutstandingBalance {
  id: string; bookingId: string; guestName: string; roomNumber: string; dueDate: string;
  amount: number; currency: CurrencyCode; overdue: boolean;
}
