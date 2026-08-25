"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Building2, ChevronDown, CircleHelp, Menu, MoreHorizontal, Search } from "lucide-react";
import { Sidebar, SidebarHeader, SidebarNavigation } from "@/components/layout/sidebar";
import {
  allSidebarItems,
  canAccessSidebarItem,
  getActiveSidebarItem,
  mobileNavLabels,
} from "@/components/layout/sidebar-config";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ApiHotelContext } from "@/types/api-contracts";
import type { AuthUser } from "@/types/auth";

const tabletRailQuery = "(min-width: 1024px) and (max-width: 1279px)";

function subscribeToTabletRail(callback: () => void) {
  const query = window.matchMedia(tabletRailQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getTabletRailSnapshot() {
  return window.matchMedia(tabletRailQuery).matches;
}

function getTabletRailServerSnapshot() {
  return false;
}

export function AppShell({
  user,
  hotel,
  children,
}: {
  user: AuthUser;
  hotel: ApiHotelContext;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(null);
  const tabletRail = useSyncExternalStore(subscribeToTabletRail, getTabletRailSnapshot, getTabletRailServerSnapshot);
  const collapsed = collapsedOverride ?? tabletRail;
  const pathname = usePathname();
  const visibleItems = allSidebarItems.filter((item) => canAccessSidebarItem(user, item));
  const current = getActiveSidebarItem(pathname, visibleItems);
  const section = current?.label ?? "Hotel ERP";
  const today = new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "min-h-dvh transition-[grid-template-columns] duration-[var(--motion-sidebar)] ease-out lg:grid",
          collapsed ? "lg:grid-cols-[var(--sidebar-width-collapsed)_1fr]" : "lg:grid-cols-[var(--sidebar-width)_1fr]",
        )}
      >
        <Sidebar user={user} collapsed={collapsed} onCollapsedChange={setCollapsedOverride} />

        <div className="min-w-0 lg:col-start-2">
          <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[286px] bg-sidebar p-0">
                <SheetHeader className="border-b border-sidebar-border p-0 text-left">
                  <SheetTitle className="sr-only">Hudheel navigation</SheetTitle>
                  <SidebarHeader />
                </SheetHeader>
                <div className="sidebar-scrollbar flex h-[calc(100dvh-4.5rem)] flex-col overflow-y-auto px-3 py-4">
                  <SidebarNavigation user={user} onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>

            <div className="hidden min-w-[220px] items-center gap-2 lg:flex">
              <Building2 className="size-4 text-primary" />
              <div className="leading-tight">
                <p className="max-w-40 truncate text-xs font-semibold">{hotel.name}</p>
                <p className="text-[10px] text-muted-foreground">{hotel.timezone} · {hotel.currencyCode}</p>
              </div>
              <ChevronDown className="ml-1 size-3.5 text-muted-foreground" />
            </div>

            <div className="ml-auto flex items-center gap-1">
              <time className="hidden whitespace-nowrap text-xs font-medium text-muted-foreground 2xl:block" suppressHydrationWarning>
                {today}
              </time>
              <Button variant="ghost" size="icon" asChild>
                <Link href="/reservations" aria-label="Search reservations and guests"><Search /></Link>
              </Button>
              <Button variant="ghost" size="icon" asChild>
                <Link href="/help" aria-label="Help and support"><CircleHelp /></Link>
              </Button>
              <ThemeToggle />
            </div>
          </header>

          <div className="border-b bg-card px-4 py-2 md:hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs text-muted-foreground">{hotel.name}</span>
              <span className="text-xs font-medium">{section}</span>
            </div>
          </div>

          <main className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-5 sm:px-6 sm:py-7 lg:px-8">
            {children}
          </main>

          <nav
            aria-label="Primary mobile navigation"
            className="fixed inset-x-0 bottom-0 z-20 grid h-20 grid-cols-5 border-t border-outline-variant bg-surface/95 px-1 pb-[max(env(safe-area-inset-bottom),4px)] backdrop-blur lg:hidden"
          >
            {visibleItems
              .filter((item) => item.href && mobileNavLabels.has(item.label))
              .map((item) => {
                const Icon = item.icon;
                const active = item.href === current?.href;
                return (
                  <Link
                    key={item.label}
                    href={item.href!}
                    prefetch={false}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium text-on-surface-variant focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45",
                      active && "text-primary",
                    )}
                  >
                    <span className={cn("grid h-8 min-w-14 place-items-center rounded-full", active && "bg-secondary")}>
                      <Icon className="size-5" strokeWidth={active ? 2.35 : 1.8} aria-hidden="true" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium text-on-surface-variant focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
              aria-label="Open all navigation"
            >
              <span className="grid h-8 min-w-14 place-items-center rounded-full">
                <MoreHorizontal className="size-5" aria-hidden="true" />
              </span>
              <span>More</span>
            </button>
          </nav>
        </div>
      </div>
    </TooltipProvider>
  );
}
