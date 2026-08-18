"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BedDouble,
  Bell,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  FileChartColumn,
  FileText,
  Gauge,
  Hammer,
  Layers3,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ReceiptText,
  ScrollText,
  Search,
  Tags,
  Settings,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BrandMark } from "@/components/shared/brand-mark";
import { PERMISSIONS } from "@/constants/permissions";
import type { Permission } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types/auth";
import { authService } from "@/services/auth.service";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  permission?: Permission;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: Gauge, permission: PERMISSIONS.dashboardRead }],
  },
  {
    label: "Hotel",
    items: [
      {
        label: "Front Desk",
        href: "/front-desk",
        icon: BookOpenCheck,
        permission: PERMISSIONS.reservationsRead,
      },
      {
        label: "Reservations",
        href: "/reservations",
        icon: CalendarDays,
        permission: PERMISSIONS.reservationsRead,
      },
      {
        label: "Calendar",
        href: "/reservations/timeline",
        icon: CalendarRange,
        permission: PERMISSIONS.reservationsRead,
      },
      {
        label: "Rooms",
        href: "/rooms",
        icon: BedDouble,
        permission: PERMISSIONS.roomsRead,
      },
      {
        label: "Floors",
        href: "/floors",
        icon: Layers3,
        permission: PERMISSIONS.floorsManage,
      },
      {
        label: "Room Types",
        href: "/room-types",
        icon: Tags,
        permission: PERMISSIONS.roomTypesManage,
      },
      {
        label: "Guests",
        href: "/guests",
        icon: UsersRound,
        permission: PERMISSIONS.guestsRead,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Housekeeping", href: "/housekeeping", icon: ClipboardCheck },
      {
        label: "Maintenance",
        href: "/maintenance",
        icon: Hammer,
        permission: PERMISSIONS.maintenanceRead,
      },
      {
        label: "Guest Services",
        href: "/services",
        icon: Sparkles,
        permission: PERMISSIONS.servicesRead,
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Accounting",
        href: "/accounting",
        icon: CircleDollarSign,
        permission: PERMISSIONS.paymentsRead,
      },
      {
        label: "Payments",
        href: "/payments",
        icon: CreditCard,
        permission: PERMISSIONS.paymentsRead,
      },
      {
        label: "Invoices",
        href: "/invoices",
        icon: FileText,
        permission: PERMISSIONS.invoicesRead,
      },
      {
        label: "Expenses",
        href: "/expenses",
        icon: ReceiptText,
        permission: PERMISSIONS.expensesRead,
      },
      {
        label: "Payment Methods",
        href: "/payment-methods",
        icon: CreditCard,
        permission: PERMISSIONS.paymentsRead,
      },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Employees", href: "/employees", icon: Building2, permission: PERMISSIONS.usersManage },
      {
        label: "Reports",
        href: "/reports",
        icon: FileChartColumn,
        permission: PERMISSIONS.reportsRead,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Users & Roles",
        href: "/users",
        icon: ShieldCheck,
        permission: PERMISSIONS.settingsRead,
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        permission: PERMISSIONS.settingsRead,
      },
      {
        label: "Audit Logs",
        href: "/audit-logs",
        icon: ScrollText,
        permission: PERMISSIONS.auditsRead,
      },
    ],
  },
];

const allNavItems = navGroups.flatMap((group) => group.items);

function getActiveNavItem(pathname: string, items: NavItem[]) {
  return items.reduce<NavItem | undefined>((bestMatch, item) => {
    if (
      !item.href ||
      (pathname !== item.href && !pathname.startsWith(`${item.href}/`))
    ) {
      return bestMatch;
    }

    return !bestMatch?.href || item.href.length > bestMatch.href.length
      ? item
      : bestMatch;
  }, undefined);
}

function Navigation({
  user,
  compact = false,
  onNavigate,
}: {
  user: AuthUser;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const activeItem = getActiveNavItem(
    pathname,
    allNavItems.filter((item) => can(user, item.permission)),
  );

  return (
    <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-5">
      {navGroups.map((group) => {
        const items = group.items.filter((item) => can(user, item.permission));
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="space-y-1.5">
            <p
              className={cn(
                "mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground",
                compact && "sr-only",
              )}
            >
              {group.label}
            </p>
            {items.map((item) => {
              const Icon = item.icon;
              const active = item.href === activeItem?.href;
              const classes = cn(
                "group relative flex h-9 items-center rounded-lg text-[13px] font-medium transition-colors",
                compact ? "justify-center px-0" : "gap-3 px-3",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/68 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                !item.href && "cursor-default text-sidebar-foreground/48",
              );
              const content = (
                <>
                  <span
                    className={cn(
                      "absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary",
                      !active && "hidden",
                    )}
                  />
                  <Icon className="size-[17px] shrink-0" aria-hidden="true" />
                  {compact ? (
                    <span className="sr-only">{item.label}</span>
                  ) : (
                    <span>{item.label}</span>
                  )}
                  {!item.href && !compact ? (
                    <span
                      className="ml-auto size-1.5 rounded-full bg-border"
                      aria-hidden="true"
                    />
                  ) : null}
                </>
              );
              return item.href ? (
                <Link
                  key={item.label}
                  href={item.href}
                  prefetch={false}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={classes}
                  title={compact ? item.label : undefined}
                >
                  {content}
                </Link>
              ) : (
                <div
                  key={item.label}
                  aria-disabled="true"
                  className={classes}
                  title={
                    compact ? `${item.label} — coming soon` : "Coming soon"
                  }
                >
                  {content}
                </div>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

function UserMenu({ user }: { user: AuthUser }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 px-1.5"
          aria-label="Open user menu"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden max-w-36 text-left leading-tight xl:block">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-[11px] capitalize text-muted-foreground">
              {user.role}
            </p>
          </div>
          <ChevronDown className="hidden size-3.5 text-muted-foreground xl:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Property settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={isLoggingOut}
          onClick={async () => {
            setIsLoggingOut(true);
            try {
              await authService.logout();
            } finally {
              router.replace("/login");
              router.refresh();
            }
          }}
        >
          <LogOut />
          {isLoggingOut ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QuickCreate() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="lg" className="hidden h-9 gap-2 sm:inline-flex">
          <Plus />
          Quick create
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Create</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/reservations/new">New reservation</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/rooms/new">New room</Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          Additional shortcuts coming soon
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const current = getActiveNavItem(pathname, allNavItems);
  const section = current?.label ?? "Hotel ERP";
  const today = new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <div
      className={cn(
        "min-h-dvh transition-[grid-template-columns] duration-200 lg:grid",
        collapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[236px_1fr]",
      )}
    >
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex lg:flex-col",
          collapsed ? "w-[76px]" : "w-[236px]",
        )}
      >
        <div
          className={cn(
            "flex h-[68px] items-center border-b border-sidebar-border",
            collapsed ? "justify-center px-3" : "justify-between px-4",
          )}
        >
          <BrandMark compact={collapsed} />
          {!collapsed ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose />
            </Button>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col overflow-y-auto px-3 py-5">
          <Navigation user={user} compact={collapsed} />
        </div>
        <div className="border-t border-sidebar-border p-3">
          {collapsed ? (
            <Button
              variant="ghost"
              size="icon"
              className="w-full"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen />
            </Button>
          ) : (
            <div className="rounded-lg bg-sidebar-accent/70 px-3 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-sidebar-accent-foreground">
                <Sparkles className="size-4" />
                Shift support
              </div>
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                Fast access to daily hotel operations.
              </p>
            </div>
          )}
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b bg-card/95 px-4 backdrop-blur sm:px-6 lg:px-7">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[286px] p-0">
              <SheetHeader className="flex h-[68px] justify-center border-b px-5 text-left">
                <SheetTitle>
                  <BrandMark />
                </SheetTitle>
              </SheetHeader>
              <div className="flex h-[calc(100dvh-4.25rem)] flex-col overflow-y-auto px-3 py-5">
                <Navigation
                  user={user}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
          <div className="hidden min-w-[220px] items-center gap-2 lg:flex">
            <Building2 className="size-4 text-primary" />
            <div className="leading-tight">
              <p className="text-xs font-semibold">Hudheel Hotel</p>
              <p className="text-[10px] text-muted-foreground">
                Mogadishu property
              </p>
            </div>
            <ChevronDown className="ml-1 size-3.5 text-muted-foreground" />
          </div>
          <div
            className="relative hidden max-w-[480px] flex-1 md:block"
            title="Global search API is not available yet"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Global search unavailable"
              placeholder="Global search requires API support"
              className="h-9 bg-background pl-9"
              disabled
            />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <time
              className="hidden whitespace-nowrap text-xs font-medium text-muted-foreground 2xl:block"
              suppressHydrationWarning
            >
              {today}
            </time>
            <QuickCreate />
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Notifications unavailable"
              title="Notifications API is not available yet"
              disabled
            >
              <Bell />
            </Button>
            <UserMenu user={user} />
          </div>
        </header>
        <div className="border-b bg-card px-4 py-2 md:hidden">
          <div className="flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Search hotel records
            </span>
            <span className="ml-auto text-xs font-medium">{section}</span>
          </div>
        </div>
        <main className="mx-auto w-full max-w-[1536px] px-4 py-5 sm:px-6 sm:py-7 lg:px-7">
          {children}
        </main>
      </div>
    </div>
  );
}
