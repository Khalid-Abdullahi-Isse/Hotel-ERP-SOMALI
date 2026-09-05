export type CurrencyCode = "USD" | "SOS";
export type TransactionStatus = "completed" | "pending" | "failed" | "refunded";
export type ExpenseStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PAID"
  | "REJECTED";

export interface FinanceMetric { label: string; value: number; currency: CurrencyCode; detail: string; tone?: "default" | "success" | "warning" }
export interface PaymentRecord {
  id: string; reference: string; date: string; guestName: string; bookingId: string;
  method: string; amount: number; currency: CurrencyCode; status: TransactionStatus;
}
export interface ExpenseRecord {
  id: string; reference: string; date: string; category: string; vendor: string;
  description: string; amount: number; currency: CurrencyCode; status: ExpenseStatus;
  reversed: boolean;
  approvedById?: string;
  paidById?: string;
}
export interface OutstandingBalance {
  id: string; bookingId: string; guestName: string; roomNumber: string; dueDate: string;
  amount: number; currency: CurrencyCode; overdue: boolean;
}
