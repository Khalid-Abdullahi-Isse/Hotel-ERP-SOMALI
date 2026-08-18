export const REFRESH_COOKIE_NAME = 'hotel_erp_refresh';

export const SYSTEM_ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export const PERMISSIONS = {
  USER_MANAGE: 'user.manage',
  ROLE_MANAGE: 'role.manage',
  HOTEL_VIEW: 'hotel.view',
  HOTEL_UPDATE: 'hotel.update',
  FLOOR_MANAGE: 'floor.manage',
  ROOM_TYPE_MANAGE: 'room_type.manage',
  ROOM_CREATE: 'room.create',
  ROOM_VIEW: 'room.view',
  ROOM_UPDATE: 'room.update',
  GUEST_CREATE: 'guest.create',
  GUEST_VIEW: 'guest.view',
  GUEST_UPDATE: 'guest.update',
  RESERVATION_CREATE: 'reservation.create',
  RESERVATION_VIEW: 'reservation.view',
  RESERVATION_UPDATE: 'reservation.update',
  RESERVATION_CONFIRM: 'reservation.confirm',
  RESERVATION_CANCEL: 'reservation.cancel',
  RESERVATION_DISCOUNT: 'reservation.discount',
  AVAILABILITY_VIEW: 'availability.view',
  CHECK_IN_CREATE: 'check_in.create',
  CHECK_OUT_CREATE: 'check_out.create',
  SERVICE_VIEW: 'service.view',
  SERVICE_MANAGE: 'service.manage',
  CHARGE_CREATE: 'charge.create',
  CHARGE_VIEW: 'charge.view',
  CHARGE_VOID: 'charge.void',
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_VIEW: 'payment.view',
  PAYMENT_REFUND: 'payment.refund',
  PAYMENT_METHOD_MANAGE: 'payment_method.manage',
  INVOICE_CREATE: 'invoice.create',
  INVOICE_VIEW: 'invoice.view',
  INVOICE_VOID: 'invoice.void',
  EXPENSE_CREATE: 'expense.create',
  EXPENSE_VIEW: 'expense.view',
  EXPENSE_CATEGORY_MANAGE: 'expense_category.manage',
  EXPENSE_REVERSE: 'expense.reverse',
  HOUSEKEEPING_VIEW: 'housekeeping.view',
  HOUSEKEEPING_UPDATE: 'housekeeping.update',
  MAINTENANCE_CREATE: 'maintenance.create',
  MAINTENANCE_VIEW: 'maintenance.view',
  MAINTENANCE_UPDATE: 'maintenance.update',
  DASHBOARD_VIEW: 'dashboard.view',
  REPORT_VIEW: 'report.view',
  AUDIT_VIEW: 'audit.view',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLE_PERMISSION_MATRIX: Record<SystemRole, readonly PermissionKey[]> = {
  ADMIN: ALL_PERMISSIONS,
  MANAGER: ALL_PERMISSIONS.filter(
    (permission) =>
      permission !== PERMISSIONS.USER_MANAGE && permission !== PERMISSIONS.ROLE_MANAGE,
  ),
  STAFF: [
    PERMISSIONS.ROOM_VIEW,
    PERMISSIONS.GUEST_CREATE,
    PERMISSIONS.GUEST_VIEW,
    PERMISSIONS.GUEST_UPDATE,
    PERMISSIONS.RESERVATION_CREATE,
    PERMISSIONS.RESERVATION_VIEW,
    PERMISSIONS.RESERVATION_UPDATE,
    PERMISSIONS.RESERVATION_CONFIRM,
    PERMISSIONS.RESERVATION_CANCEL,
    PERMISSIONS.AVAILABILITY_VIEW,
    PERMISSIONS.CHECK_IN_CREATE,
    PERMISSIONS.CHECK_OUT_CREATE,
    PERMISSIONS.SERVICE_VIEW,
    PERMISSIONS.CHARGE_CREATE,
    PERMISSIONS.CHARGE_VIEW,
    PERMISSIONS.PAYMENT_CREATE,
    PERMISSIONS.PAYMENT_VIEW,
    PERMISSIONS.INVOICE_CREATE,
    PERMISSIONS.INVOICE_VIEW,
    PERMISSIONS.EXPENSE_CREATE,
    PERMISSIONS.EXPENSE_VIEW,
    PERMISSIONS.HOUSEKEEPING_VIEW,
    PERMISSIONS.HOUSEKEEPING_UPDATE,
    PERMISSIONS.MAINTENANCE_CREATE,
    PERMISSIONS.MAINTENANCE_VIEW,
  ],
};
