import type { CurrencyCode } from "@/types/finance";

export function formatCurrency(amount: number, currency: CurrencyCode = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: currency === "SOS" ? 0 : 2 }).format(amount);
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value.includes("T") ? value : `${value}T00:00:00`));
}

export function titleCase(value: string) {
  return value.split("_").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
}
