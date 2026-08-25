"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ChevronDown, LogOut, MoreVertical, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { BrandMark } from "@/components/shared/brand-mark";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PERMISSIONS } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { authService } from "@/services/auth.service";
import type { AuthUser } from "@/types/auth";
import {
  allSidebarItems,
  canAccessSidebarItem,
  getActiveSidebarItem,
  sidebarSections,
  sidebarSupportItems,
} from "@/components/layout/sidebar-config";
import type { SidebarNavItem, SidebarNavSection } from "@/components/layout/sidebar-config";

const itemStateClasses = {
  default: "text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-sidebar-foreground",
  active: "hudheel-active-rail bg-sidebar-active text-sidebar-active-text",
  childActive: "text-sidebar-foreground",
  disabled: "cursor-not-allowed text-sidebar-foreground/35",
} as const;

export function SidebarBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-auto min-w-5 rounded-full bg-sidebar-container px-1.5 py-0.5 text-center text-[11px] font-semibold leading-4 text-sidebar-foreground">
      {children}
    </span>
  );
}

function ItemIcon({ item, active, small = false }: { item: SidebarNavItem; active: boolean; small?: boolean }) {
  const Icon = item.icon;
  return (
    <Icon
      className={cn("size-5 shrink-0 transition-colors duration-[var(--motion-active)]", small && "size-4", active && "text-sidebar-active-icon")}
      strokeWidth={active ? 2.35 : 1.8}
      aria-hidden="true"
    />
  );
}

export function SidebarItem({
  item,
  active,
  compact,
  onNavigate,
}: {
  item: SidebarNavItem;
  active: boolean;
  compact: boolean;
  onNavigate?: () => void;
}) {
  const classes = cn(
    "group relative flex h-[var(--sidebar-item-height)] w-full items-center rounded-[var(--sidebar-item-radius)] text-sm font-medium transition-colors duration-[var(--motion-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/45 focus-visible:ring-offset-1",
    compact ? "justify-center px-0" : "gap-3 px-3",
    item.disabled ? itemStateClasses.disabled : active ? itemStateClasses.active : itemStateClasses.default,
  );

  const content = (
    <>
      <ItemIcon item={item} active={active} />
      <span className={compact ? "sr-only" : "truncate"}>{item.label}</span>
    </>
  );

  const control = item.disabled || !item.href ? (
    <button type="button" className={classes} disabled aria-disabled="true">
      {content}
    </button>
  ) : (
    <Link
      href={item.href}
      prefetch={false}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-description={item.placeholder ? "Opens the Property Setup overview" : undefined}
      className={classes}
    >
      {content}
    </Link>
  );

  if (!compact) return control;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{control}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function SidebarSubItem({
  item,
  active,
  onNavigate,
}: {
  item: SidebarNavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  if (!item.href) return null;
  return (
    <Link
      href={item.href}
      prefetch={false}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-description={item.placeholder ? "Opens the Property Setup overview" : undefined}
      className={cn(
        "group relative ms-4 flex h-[var(--sidebar-item-height)] items-center gap-3 rounded-[var(--sidebar-item-radius)] ps-5 pe-3 text-sm font-medium transition-colors duration-[var(--motion-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/45 focus-visible:ring-offset-1",
        active ? itemStateClasses.active : itemStateClasses.default,
      )}
    >
      <ItemIcon item={item} active={active} small />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function SidebarGroup({
  item,
  activeItem,
  compact,
  onNavigate,
  onRequestExpand,
}: {
  item: SidebarNavItem;
  activeItem?: SidebarNavItem;
  compact: boolean;
  onNavigate?: () => void;
  onRequestExpand?: () => void;
}) {
  const children = item.children ?? [];
  const childActive = children.some((child) => child.href === activeItem?.href);
  const [expanded, setExpanded] = useState(false);
  const groupId = useId();
  const open = childActive || expanded;

  const toggle = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={groupId}
      onClick={() => {
        if (compact) {
          onRequestExpand?.();
          setExpanded(true);
          return;
        }
        setExpanded((value) => !value);
      }}
      className={cn(
        "group flex h-[var(--sidebar-item-height)] w-full items-center rounded-[var(--sidebar-item-radius)] text-sm font-medium transition-colors duration-[var(--motion-hover)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/45 focus-visible:ring-offset-1",
        compact ? "justify-center px-0" : "gap-3 px-3",
        childActive ? itemStateClasses.childActive : itemStateClasses.default,
      )}
    >
      <ItemIcon item={item} active={childActive} />
      <span className={compact ? "sr-only" : "truncate"}>{item.label}</span>
      {compact ? null : (
        <ChevronDown
          className={cn("ml-auto size-4 text-sidebar-foreground/55 transition-transform duration-[var(--motion-group)]", open && "rotate-180")}
          aria-hidden="true"
        />
      )}
    </button>
  );

  return (
    <div>
      {compact ? (
        <Tooltip>
          <TooltipTrigger asChild>{toggle}</TooltipTrigger>
          <TooltipContent side="right">Property Setup</TooltipContent>
        </Tooltip>
      ) : toggle}
      <div
        id={groupId}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-[var(--motion-group)] ease-out",
          compact || !open ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-1 pt-1">
            {children.map((child) => (
              <SidebarSubItem key={child.label} item={child} active={child.href === activeItem?.href} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SidebarSection({
  section,
  activeItem,
  compact,
  onNavigate,
  onRequestExpand,
}: {
  section: SidebarNavSection;
  activeItem?: SidebarNavItem;
  compact: boolean;
  onNavigate?: () => void;
  onRequestExpand?: () => void;
}) {
  return (
    <section aria-labelledby={section.label ? `sidebar-section-${section.label}` : undefined} className="space-y-1">
      {section.label ? (
        <h2
          id={`sidebar-section-${section.label}`}
          className={cn(
            "mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-sidebar-foreground/55",
            compact && "sr-only",
          )}
        >
          {section.label}
        </h2>
      ) : null}
      {section.items.map((item) =>
        item.children ? (
          <SidebarGroup
            key={item.label}
            item={item}
            activeItem={activeItem}
            compact={compact}
            onNavigate={onNavigate}
            onRequestExpand={onRequestExpand}
          />
        ) : (
          <SidebarItem key={item.label} item={item} active={item.href === activeItem?.href} compact={compact} onNavigate={onNavigate} />
        ),
      )}
    </section>
  );
}

export function SidebarNavigation({
  user,
  compact = false,
  onNavigate,
  onRequestExpand,
}: {
  user: AuthUser;
  compact?: boolean;
  onNavigate?: () => void;
  onRequestExpand?: () => void;
}) {
  const pathname = usePathname();
  const visibleItems = allSidebarItems.filter((item) => canAccessSidebarItem(user, item));
  const activeItem = getActiveSidebarItem(pathname, visibleItems);

  return (
    <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-6">
      {sidebarSections.map((section) => {
        const visibleSection = {
          ...section,
          items: section.items
            .filter((item) => canAccessSidebarItem(user, item))
            .map((item) => ({
              ...item,
              children: item.children?.filter((child) => canAccessSidebarItem(user, child)),
            })),
        };
        if (visibleSection.items.length === 0) return null;
        return (
          <SidebarSection
            key={section.label || "dashboard"}
            section={visibleSection}
            activeItem={activeItem}
            compact={compact}
            onNavigate={onNavigate}
            onRequestExpand={onRequestExpand}
          />
        );
      })}
    </nav>
  );
}

export function SidebarHeader({ compact = false, onToggle }: { compact?: boolean; onToggle?: () => void }) {
  return (
    <div className={cn("flex h-[72px] shrink-0 items-center", compact ? "justify-center px-3" : "justify-between px-4")}>
      <BrandMark compact={compact} />
      {!compact && onToggle ? (
        <Button variant="ghost" size="icon-sm" className="text-sidebar-foreground/65" onClick={onToggle} aria-label="Collapse sidebar">
          <PanelLeftClose />
        </Button>
      ) : null}
    </div>
  );
}

function roleLabel(role: string) {
  return role.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function UserMenu({ user, compact = false }: { user: AuthUser; compact?: boolean }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const initials = user.name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  const trigger = (
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className={cn(
          "flex h-14 w-full items-center rounded-[10px] transition-colors duration-150 hover:bg-sidebar-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/45",
          compact ? "justify-center px-0" : "gap-3 px-2",
        )}
        aria-label="Open user profile menu"
      >
        <Avatar className="size-9 shrink-0">
          <AvatarFallback className="bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">{initials}</AvatarFallback>
        </Avatar>
        {compact ? null : (
          <>
            <span className="min-w-0 flex-1 text-left leading-tight">
              <span className="block truncate text-sm font-medium text-sidebar-foreground">{user.name}</span>
              <span className="mt-1 block truncate text-xs font-normal text-sidebar-foreground/60">{roleLabel(user.role)}</span>
            </span>
            <MoreVertical className="size-4 shrink-0 text-sidebar-foreground/55" aria-hidden="true" />
          </>
        )}
      </button>
    </DropdownMenuTrigger>
  );

  return (
    <DropdownMenu>
      {compact ? (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent side="right">{user.name}</TooltipContent>
        </Tooltip>
      ) : trigger}
      <DropdownMenuContent side="right" align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {can(user, PERMISSIONS.settingsRead) ? (
          <DropdownMenuItem asChild>
            <Link href="/settings"><Settings />Property settings</Link>
          </DropdownMenuItem>
        ) : null}
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

export function CollapseButton({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";
  const button = (
    <Button variant="ghost" size="icon" className="h-11 w-full text-sidebar-foreground/65" onClick={onToggle} aria-label={label}>
      <Icon className="size-5" />
    </Button>
  );
  if (!collapsed) return button;
  return <Tooltip><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip>;
}

export function SidebarFooter({
  user,
  compact,
  onToggle,
}: {
  user: AuthUser;
  compact: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const activeItem = getActiveSidebarItem(pathname);
  return (
    <footer className="shrink-0 border-t border-sidebar-border px-3 py-2">
      <div className="space-y-1 pb-2">
        {sidebarSupportItems.filter((item) => canAccessSidebarItem(user, item)).map((item) => (
          <SidebarItem key={item.label} item={item} active={item.href === activeItem?.href} compact={compact} />
        ))}
      </div>
      <div className="border-t border-sidebar-border pt-2">
        <UserMenu user={user} compact={compact} />
        {compact ? <CollapseButton collapsed onToggle={onToggle} /> : null}
      </div>
    </footer>
  );
}

export function Sidebar({ user, collapsed, onCollapsedChange }: { user: AuthUser; collapsed: boolean; onCollapsedChange: (value: boolean) => void }) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-[var(--motion-sidebar)] ease-out lg:flex",
        collapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width)]",
      )}
    >
      <SidebarHeader compact={collapsed} onToggle={() => onCollapsedChange(true)} />
      <div className="sidebar-scrollbar flex flex-1 flex-col overflow-y-auto px-3 py-4">
        <SidebarNavigation user={user} compact={collapsed} onRequestExpand={() => onCollapsedChange(false)} />
      </div>
      <SidebarFooter user={user} compact={collapsed} onToggle={() => onCollapsedChange(!collapsed)} />
    </aside>
  );
}
