import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiReservationPayments } from "@/types/api-contracts";
import { CheckoutPaymentSection } from "./checkout-payment-section";

const pagination = {
  page: 1,
  limit: 30,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

function renderSection(payments: ApiReservationPayments, canPay = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CheckoutPaymentSection
        reservationId="reservation-1"
        payments={payments}
        currency="USD"
        canPay={canPay}
        onPaymentRecorded={vi.fn().mockResolvedValue("0")}
      />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("CheckoutPaymentSection", () => {
  it("shows the balance and a permission-aware payment state", () => {
    renderSection({
      data: [],
      pagination,
      summary: {
        totalAmount: "420",
        paidAmount: "100",
        refundedAmount: "0",
        netPaidAmount: "100",
        outstandingAmount: "320",
      },
    });

    expect(screen.getByText("Balance due")).toBeInTheDocument();
    expect(screen.getByText("$320.00")).toBeInTheDocument();
    expect(screen.getByText(/do not have permission to record payments/i)).toBeInTheDocument();
  });

  it("marks a settled folio as ready for checkout", () => {
    renderSection({
      data: [],
      pagination,
      summary: {
        totalAmount: "420",
        paidAmount: "420",
        refundedAmount: "0",
        netPaidAmount: "420",
        outstandingAmount: "0",
      },
    });

    expect(screen.getByText("Paid in full")).toBeInTheDocument();
    expect(screen.getByText("Ready for checkout")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /record payment/i })).not.toBeInTheDocument();
  });
});
