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

export function currentDateInTimeZone(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
