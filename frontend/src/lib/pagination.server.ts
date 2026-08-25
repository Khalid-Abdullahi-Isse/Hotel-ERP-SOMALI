import "server-only";
import { redirect } from "next/navigation";

export function redirectOutOfRangePage(
  requestedPage: number,
  totalPages: number,
  pathname: string,
  params: Record<string, string | undefined>,
): void {
  if (totalPages === 0 || requestedPage <= totalPages) return;
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, value); });
  query.set("page", String(totalPages));
  redirect(`${pathname}?${query.toString()}`);
}
