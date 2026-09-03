function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeAccountingDate(value: string | undefined, fallback: string) {
  return value && value.trim() ? value.trim() : fallback;
}

export function accountingPeriod() {
  const now = new Date();
  const dateTo = formatIsoDate(now);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const dateFrom = formatIsoDate(startOfMonth);
  return { dateFrom, dateTo };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? 0 : Number(trimmed);
  }
  if (value && typeof value === "object" && "toString" in value) {
    return Number(String(value));
  }
  return 0;
}

export function accountingMoney(value: unknown, currency: string) {
  const num = toNumber(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function accountingSignedDelta(value: unknown, currency: string) {
  const num = toNumber(value);
  if (num === 0) return accountingMoney(0, currency);
  const formatted = accountingMoney(Math.abs(num), currency);
  return num < 0 ? `(${formatted})` : formatted;
}
