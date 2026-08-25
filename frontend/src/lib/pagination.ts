export const DEFAULT_PAGE_SIZE = 30;

export function parsePage(value: string | string[] | undefined): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value ?? "1");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function listQuery(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  if (!query.has("limit")) query.set("limit", String(DEFAULT_PAGE_SIZE));
  return query.toString();
}
