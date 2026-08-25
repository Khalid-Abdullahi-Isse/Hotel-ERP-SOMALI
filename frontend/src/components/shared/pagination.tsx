import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function hrefFor(
  page: number,
  searchParams: Record<string, string | undefined>,
) {
  const query = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  query.set("page", String(page));
  return `?${query.toString()}`;
}

function pageItems(
  page: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7)
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = [
    ...new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]),
  ]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];
  pages.forEach((value, index) => {
    if (index > 0 && value - pages[index - 1] > 1) result.push("ellipsis");
    result.push(value);
  });
  return result;
}

export function Pagination({
  page,
  limit,
  totalPages,
  total,
  searchParams,
  itemLabel = "records",
}: {
  page: number;
  limit: number;
  totalPages: number;
  total: number;
  searchParams: Record<string, string | undefined>;
  itemLabel?: string;
}) {
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = total === 0 ? 0 : Math.min(page * limit, total);
  const range =
    total === 0
      ? "Showing 0 of 0"
      : `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`;
  return (
    <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {range} {itemLabel}
      </p>
      <nav
        className="flex flex-wrap items-center gap-1"
        aria-label={`${itemLabel} pagination`}
      >
        {page <= 1 ? (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft />
            Previous
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefFor(page - 1, searchParams)}>
              <ChevronLeft />
              Previous
            </Link>
          </Button>
        )}
        {pageItems(page, totalPages).map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-muted-foreground"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Button
              key={item}
              asChild
              variant={item === page ? "default" : "outline"}
              size="sm"
            >
              <Link
                href={hrefFor(item, searchParams)}
                aria-current={item === page ? "page" : undefined}
              >
                {item}
              </Link>
            </Button>
          ),
        )}
        {page >= totalPages || totalPages === 0 ? (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight />
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={hrefFor(page + 1, searchParams)}>
              Next
              <ChevronRight />
            </Link>
          </Button>
        )}
      </nav>
    </div>
  );
}
