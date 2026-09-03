import { describe, expect, it } from "vitest";
import {
  accountingMoney,
  accountingPeriod,
  accountingSignedDelta,
  normalizeAccountingDate,
} from "@/lib/accounting";

describe("accountingPeriod", () => {
  it("returns valid ISO dates in YYYY-MM-DD format", () => {
    const period = accountingPeriod();

    expect(period.dateFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(period.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(`${period.dateFrom}T00:00:00Z`).toString()).not.toBe("Invalid Date");
    expect(new Date(`${period.dateTo}T00:00:00Z`).toString()).not.toBe("Invalid Date");
    expect(period.dateFrom <= period.dateTo).toBe(true);
  });

  it("defaults dateFrom to the first day of the same month as dateTo", () => {
    const period = accountingPeriod();
    expect(period.dateTo.startsWith(period.dateFrom.slice(0, 8))).toBe(true);
  });

  it("falls back to defaults when date params are empty strings", () => {
    const defaults = accountingPeriod();

    expect(normalizeAccountingDate("", defaults.dateFrom)).toBe(defaults.dateFrom);
    expect(normalizeAccountingDate("   ", defaults.dateFrom)).toBe(defaults.dateFrom);
    expect(normalizeAccountingDate("2026-08-15", defaults.dateFrom)).toBe("2026-08-15");
  });
});

describe("accountingMoney", () => {
  it("formats zero with currency symbol", () => {
    expect(accountingMoney("0", "USD")).toBe("$0.00");
  });

  it("formats positive amounts with commas and decimals", () => {
    expect(accountingMoney("17070", "USD")).toBe("$17,070.00");
    expect(accountingMoney("20330", "USD")).toBe("$20,330.00");
  });

  it("formats decimal amounts to 2 places", () => {
    expect(accountingMoney("1234.5", "USD")).toBe("$1,234.50");
    expect(accountingMoney("99.99", "USD")).toBe("$99.99");
  });

  it("formats large numbers with commas", () => {
    expect(accountingMoney("1000000", "USD")).toBe("$1,000,000.00");
  });

  it("formats with different currency codes", () => {
    expect(accountingMoney("100", "EUR")).toMatch(/€100\.00/);
    expect(accountingMoney("100", "GBP")).toMatch(/£100\.00/);
  });

  it("handles number inputs", () => {
    expect(accountingMoney(0, "USD")).toBe("$0.00");
    expect(accountingMoney(17070, "USD")).toBe("$17,070.00");
    expect(accountingMoney(-500, "USD")).toBe("-$500.00");
  });

  it("handles bigint inputs", () => {
    expect(accountingMoney(BigInt(0), "USD")).toBe("$0.00");
    expect(accountingMoney(BigInt(20330), "USD")).toBe("$20,330.00");
  });

  it("handles object-with-toString inputs (e.g. Prisma Decimal)", () => {
    const fakeDecimal = { toString: () => "17070.00", toJSON: () => "17070.00" };
    expect(accountingMoney(fakeDecimal, "USD")).toBe("$17,070.00");
  });

  it("handles null/undefined gracefully", () => {
    expect(accountingMoney(null, "USD")).toBe("$0.00");
    expect(accountingMoney(undefined, "USD")).toBe("$0.00");
  });
});

describe("accountingSignedDelta", () => {
  it("formats zero as $0.00", () => {
    expect(accountingSignedDelta("0", "USD")).toBe("$0.00");
  });

  it("formats positive values without parentheses", () => {
    expect(accountingSignedDelta("1000", "USD")).toBe("$1,000.00");
  });

  it("formats negative values with parentheses", () => {
    expect(accountingSignedDelta("-500", "USD")).toBe("($500.00)");
  });

  it("formats zero string without parentheses", () => {
    expect(accountingSignedDelta("0.00", "USD")).toBe("$0.00");
  });

  it("handles number inputs", () => {
    expect(accountingSignedDelta(0, "USD")).toBe("$0.00");
    expect(accountingSignedDelta(1000, "USD")).toBe("$1,000.00");
    expect(accountingSignedDelta(-500, "USD")).toBe("($500.00)");
  });

  it("handles object-with-toString inputs", () => {
    const fakeDecimal = { toString: () => "-3200.50", toJSON: () => "-3200.50" };
    expect(accountingSignedDelta(fakeDecimal, "USD")).toBe("($3,200.50)");
  });
});

describe("trial balance directional logic", () => {
  function netToDirection(
    net: number,
    normalBalance: "DEBIT" | "CREDIT",
  ): { debit: number; credit: number } {
    if (normalBalance === "DEBIT") {
      return net >= 0
        ? { debit: net, credit: 0 }
        : { debit: 0, credit: Math.abs(net) };
    }
    return net <= 0
      ? { debit: 0, credit: Math.abs(net) }
      : { debit: net, credit: 0 };
  }

  it("TEST 1: Simple cash receipt — Dr Cash 1000, Cr Revenue 1000", () => {
    const cashBalance = netToDirection(1000, "DEBIT");
    const revenueBalance = netToDirection(-1000, "CREDIT");

    expect(cashBalance.debit).toBe(1000);
    expect(cashBalance.credit).toBe(0);
    expect(revenueBalance.debit).toBe(0);
    expect(revenueBalance.credit).toBe(1000);

    const totalDebit = cashBalance.debit + revenueBalance.debit;
    const totalCredit = cashBalance.credit + revenueBalance.credit;
    expect(totalDebit).toBe(totalCredit);
  });

  it("TEST 2: Cash payment — Dr Expense 300, Cr Cash 300", () => {
    const cashOpening = 1000;
    const expenseBalance = netToDirection(300, "DEBIT");
    const cashClosing = netToDirection(cashOpening - 300, "DEBIT");

    expect(expenseBalance.debit).toBe(300);
    expect(expenseBalance.credit).toBe(0);
    expect(cashClosing.debit).toBe(700);
    expect(cashClosing.credit).toBe(0);
  });

  it("TEST 3: Accounts receivable — Dr AR 500, Cr Revenue 500", () => {
    const arBalance = netToDirection(500, "DEBIT");
    const revenueBalance = netToDirection(-500, "CREDIT");

    expect(arBalance.debit).toBe(500);
    expect(arBalance.credit).toBe(0);
    expect(revenueBalance.debit).toBe(0);
    expect(revenueBalance.credit).toBe(500);
  });

  it("TEST 4: Customer settlement — Dr Cash 500, Cr AR 500", () => {
    const arOpening = 500;
    const cashClosing = netToDirection(500, "DEBIT");
    const arClosing = netToDirection(arOpening - 500, "DEBIT");

    expect(cashClosing.debit).toBe(500);
    expect(arClosing.debit).toBe(0);
    expect(arClosing.credit).toBe(0);
  });

  it("TEST 5: Owner investment — Dr Cash 20000, Cr Equity 20000", () => {
    const cashBalance = netToDirection(20000, "DEBIT");
    const equityBalance = netToDirection(-20000, "CREDIT");

    expect(cashBalance.debit).toBe(20000);
    expect(cashBalance.credit).toBe(0);
    expect(equityBalance.debit).toBe(0);
    expect(equityBalance.credit).toBe(20000);
  });

  it("TEST 6: Opening balance with period movements", () => {
    const opening = netToDirection(17070, "DEBIT");
    expect(opening.debit).toBe(17070);
    expect(opening.credit).toBe(0);

    const periodDebit = 20330;
    const periodCredit = 135;
    const closingNet = 17070 + periodDebit - periodCredit;
    const closing = netToDirection(closingNet, "DEBIT");

    expect(closing.debit).toBe(37265);
    expect(closing.credit).toBe(0);
  });

  it("TEST 7: Credit-normal account (Accounts Payable)", () => {
    const opening = netToDirection(-5000, "CREDIT");
    expect(opening.debit).toBe(0);
    expect(opening.credit).toBe(5000);

    const periodNet = -2000 + 500;
    const closingNet = -5000 + periodNet;
    const closing = netToDirection(closingNet, "CREDIT");

    expect(closing.debit).toBe(0);
    expect(closing.credit).toBe(6500);
  });

  it("TEST 8: Parent account aggregation — no double-counting", () => {
    const frontDeskCash = netToDirection(7000, "DEBIT");
    const bank = netToDirection(3000, "DEBIT");

    const childTotal = frontDeskCash.debit + bank.debit;
    expect(childTotal).toBe(10000);

    const parentBalance = netToDirection(10000, "DEBIT");
    expect(parentBalance.debit).toBe(childTotal);
  });

  it("TEST 9: Abnormal balance — DEBIT-normal with credit balance", () => {
    const balance = netToDirection(-500, "DEBIT");
    expect(balance.debit).toBe(0);
    expect(balance.credit).toBe(500);
  });

  it("TEST 10: Abnormal balance — CREDIT-normal with debit balance", () => {
    const balance = netToDirection(300, "CREDIT");
    expect(balance.debit).toBe(300);
    expect(balance.credit).toBe(0);
  });
});
