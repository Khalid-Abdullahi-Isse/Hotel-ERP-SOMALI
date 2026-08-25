import type { LucideIcon } from "lucide-react";
import {
  BedDouble,
  BookOpenCheck,
  Building2,
  CalendarCheck2,
  CalendarRange,
  CircleDollarSign,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  FileChartColumn,
  FileText,
  Gauge,
  Hammer,
  Layers3,
  ReceiptText,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Tags,
  UsersRound,
  UserCog,
  Waves,
} from "lucide-react";
import { PERMISSIONS } from "@/constants/permissions";
import type { Permission } from "@/constants/permissions";
import { can } from "@/lib/permissions";
import type { AuthUser } from "@/types/auth";

export interface SidebarNavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  permission?: Permission;
  permissions?: Permission[];
  children?: SidebarNavItem[];
  placeholder?: boolean;
  disabled?: boolean;
  adminOnly?: boolean;
}

export interface SidebarNavSection {
  label: string;
  items: SidebarNavItem[];
}

export const sidebarSections: SidebarNavSection[] = [
  {
    label: "",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: Gauge,
        permission: PERMISSIONS.dashboardRead,
      },
    ],
  },
  {
    label: "Operations",
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
        icon: CalendarCheck2,
        permission: PERMISSIONS.reservationsRead,
      },
      {
        label: "Calendar",
        href: "/reservations/timeline",
        icon: CalendarRange,
        permission: PERMISSIONS.reservationsRead,
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
    label: "Property",
    items: [
      {
        label: "Rooms",
        href: "/rooms",
        icon: BedDouble,
        permission: PERMISSIONS.roomsRead,
      },
      {
        label: "Property Setup",
        icon: Building2,
        permissions: [PERMISSIONS.floorsManage, PERMISSIONS.roomTypesManage],
        children: [
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
            label: "Amenities",
            href: "/property",
            icon: Waves,
            permissions: [
              PERMISSIONS.floorsManage,
              PERMISSIONS.roomTypesManage,
            ],
            placeholder: true,
          },
        ],
      },
    ],
  },
  {
    label: "Services",
    items: [
      {
        label: "Housekeeping",
        href: "/housekeeping",
        icon: ClipboardCheck,
        permission: PERMISSIONS.housekeepingRead,
      },
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
        permission: PERMISSIONS.financialReportsRead,
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
    ],
  },
  {
    label: "Management",
    items: [
      {
        label: "Reports",
        href: "/reports",
        icon: FileChartColumn,
        permission: PERMISSIONS.reportsRead,
      },
      {
        label: "Audit Logs",
        href: "/audit-logs",
        icon: ScrollText,
        permission: PERMISSIONS.auditsRead,
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Users",
        href: "/admin/users",
        icon: UserCog,
        permission: PERMISSIONS.userManage,
        adminOnly: true,
      },
      {
        label: "Roles",
        href: "/admin/roles",
        icon: Shield,
        permission: PERMISSIONS.roleManage,
        adminOnly: true,
      },
    ],
  },
];

export const sidebarSupportItems: SidebarNavItem[] = [
  { label: "Help & Support", href: "/help", icon: CircleHelp },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    permission: PERMISSIONS.settingsRead,
  },
];

export const allSidebarItems = [
  ...sidebarSections.flatMap((section) =>
    section.items.flatMap((item) => [item, ...(item.children ?? [])]),
  ),
  ...sidebarSupportItems,
];

export const mobileNavLabels = new Set([
  "Dashboard",
  "Front Desk",
  "Reservations",
  "Rooms",
]);

export function canAccessSidebarItem(user: AuthUser, item: SidebarNavItem) {
  return (
    (!item.adminOnly || user.roles.includes("ADMIN")) &&
    can(user, item.permission) &&
    (item.permissions?.some((permission) => can(user, permission)) ?? true)
  );
}

export function getActiveSidebarItem(
  pathname: string,
  items: SidebarNavItem[] = allSidebarItems,
) {
  return items.reduce<SidebarNavItem | undefined>((bestMatch, item) => {
    if (
      !item.href ||
      (pathname !== item.href && !pathname.startsWith(`${item.href}/`))
    )
      return bestMatch;
    return !bestMatch?.href || item.href.length > bestMatch.href.length
      ? item
      : bestMatch;
  }, undefined);
}
