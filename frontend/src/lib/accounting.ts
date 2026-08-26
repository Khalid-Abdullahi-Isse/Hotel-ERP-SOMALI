export function accountingPeriod() {
  const now = new Date();
  const dateTo = now.toISOString().slice(0, 10);
  const dateFrom = `${dateTo.slice(0, 8)}01`;
  return { dateFrom, dateTo };
}

export function accountingMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}
