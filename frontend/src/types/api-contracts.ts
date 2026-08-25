export interface ApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiPage<T> {
  data: T[];
  pagination: ApiPagination;
}

export type ApiRoomStatus =
  "AVAILABLE" | "RESERVED" | "OCCUPIED" | "DIRTY" | "CLEANING" | "MAINTENANCE";
export type ApiReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "NO_SHOW";

export interface ApiFloor {
  id: string;
  number: number;
  name: string | null;
  _count?: { rooms: number };
  createdAt?: string;
  updatedAt?: string;
}
export interface ApiRoomType {
  id: string;
  code: string;
  name: string;
  capacityAdults: number;
  capacityChildren: number;
  description?: string | null;
  basePrice: string;
  isActive: boolean;
  _count?: { rooms: number };
  createdAt?: string;
  updatedAt?: string;
}
export interface ApiService {
  id: string;
  name: string;
  description: string | null;
  defaultPrice: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ApiCharge {
  id: string;
  type: "ROOM" | "SERVICE" | "DISCOUNT" | "OTHER";
  description: string;
  quantity: string;
  unitPrice: string;
  totalAmount: string;
  chargeDate: string;
  voidedAt: string | null;
  service?: { id: string; name: string } | null;
}
export interface ApiPaymentMethod {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ApiPayment {
  id: string;
  kind: "PAYMENT" | "REFUND";
  status: "COMPLETED" | "VOIDED";
  amount: string;
  reference: string | null;
  note: string | null;
  paidAt: string;
  createdAt: string;
  paymentMethod: { id: string; name: string };
  hotel: { currencyCode: "USD" | "SOS" };
  guest: { id: string; fullName: string } | null;
  reservation: { id: string; bookingNumber: string } | null;
  createdBy: { id: string; fullName: string };
}
export interface ApiExpense {
  id: string;
  amount: string;
  expenseDate: string;
  description: string;
  reference: string | null;
  reversed: boolean;
  reversedAt: string | null;
  category: { id: string; name: string };
  hotel: { currencyCode: "USD" | "SOS" };
  paymentMethod: { id: string; name: string } | null;
  createdBy: { id: string; fullName: string };
}
export interface ApiHousekeepingTask {
  id: string;
  status: "DIRTY" | "CLEANING" | "COMPLETED";
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  room: {
    id: string;
    roomNumber: string;
    status: ApiRoomStatus;
    floor: { number: number; name: string | null } | null;
  };
  assignedTo: { id: string; fullName: string } | null;
  reservation: { id: string; bookingNumber: string } | null;
}
export type ApiMaintenanceStatus = "OPEN" | "IN_PROGRESS" | "DONE";
export interface ApiMaintenanceRequest {
  id: string;
  roomId: string;
  assignedToId: string | null;
  createdById: string | null;
  problem: string;
  status: ApiMaintenanceStatus;
  cost: string | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  room: { id: string; roomNumber: string; status: ApiRoomStatus };
  assignedTo: { id: string; fullName: string } | null;
  createdBy: { id: string; fullName: string } | null;
}
export interface ApiAuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; fullName: string } | null;
}
export interface ApiAuditPage {
  data: ApiAuditLog[];
  pagination: ApiPagination;
}
export interface ApiInvoice {
  id: string;
  invoiceNumber: string;
  status: "DRAFT" | "ISSUED" | "PAID" | "PARTIALLY_PAID" | "VOIDED";
  subtotal: string;
  discountAmount: string;
  totalAmount: string;
  netPaidAmount: string;
  outstandingAmount: string;
  issuedAt: string | null;
  createdAt: string;
  hotel: { currencyCode: "USD" | "SOS" };
  reservation: {
    id: string;
    bookingNumber: string;
    guest: { id: string; fullName: string };
  };
}
export interface ApiRoom {
  id: string;
  roomNumber: string;
  floorId: string | null;
  floor: ApiFloor | null;
  roomTypeId: string;
  roomType: ApiRoomType;
  status: ApiRoomStatus;
  effectivePrice: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ApiGuest {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  passportNumber?: string | null;
  nationalId?: string | null;
  nationality: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ApiReservationRoom {
  id: string;
  roomId: string;
  nightlyRate: string;
  roomTotal: string;
  room: ApiRoom;
}
export interface ApiReservation {
  id: string;
  bookingNumber: string;
  guestId: string;
  guest: Pick<ApiGuest, "id" | "fullName" | "phone" | "email">;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  status: ApiReservationStatus;
  notes: string | null;
  rooms: ApiReservationRoom[];
  nights: number;
  discountAmount: string;
  subtotal: string;
  estimatedTotal: string;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  history?: Array<{
    id: string;
    fromStatus: ApiReservationStatus | null;
    toStatus: ApiReservationStatus;
    note: string | null;
    changedById: string | null;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
export interface ApiAvailabilityResult {
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  pagination: ApiPagination;
  data: Array<ApiRoom & { nightlyRate: string; estimatedRoomTotal: string }>;
}

export interface ApiFolio {
  reservation: {
    id: string;
    bookingNumber: string;
    status: ApiReservationStatus;
    guest: { id: string; fullName: string };
    checkInDate: string;
    checkOutDate: string;
    checkedInAt: string | null;
    checkedOutAt: string | null;
  };
  roomLines: Array<{
    reservationRoomId: string;
    roomId: string;
    roomNumber: string;
    nights: number;
    nightlyRate: string;
    amount: string;
    chargeId: string | null;
    posted: boolean;
    voided: boolean;
  }>;
  charges: ApiCharge[];
  subtotal: string;
  discountAmount: string;
  total: string;
  roomChargesPosted: boolean;
}

export interface ApiPaymentSummary {
  totalAmount: string;
  paidAmount: string;
  refundedAmount: string;
  netPaidAmount: string;
  outstandingAmount: string;
}

export interface ApiReservationPayments {
  data: ApiPayment[];
  pagination: ApiPagination;
  summary: ApiPaymentSummary;
}

export interface ApiCheckInResult {
  alreadyCompleted: boolean;
  reservation: ApiReservation;
}

export interface ApiCheckOutResult {
  alreadyCompleted: boolean;
  folio: ApiFolio;
}
export interface ApiReservationTimelineResult {
  startDate: string;
  endDate: string;
  pagination: ApiPagination;
  rooms: Array<Pick<ApiRoom, "id" | "roomNumber" | "floor" | "roomType">>;
  reservations: Array<
    Pick<
      ApiReservation,
      "id" | "bookingNumber" | "checkInDate" | "checkOutDate" | "status"
    > & {
      guest: Pick<ApiGuest, "fullName">;
      rooms: Array<Pick<ApiReservationRoom, "roomId">>;
    }
  >;
}
export interface ApiAuthUser {
  id: string;
  hotelId: string;
  email: string;
  username: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}
export interface ApiCurrentUser extends ApiAuthUser {
  sessionId: string;
}
export interface ApiAuthenticationResult {
  accessToken: string;
  expiresIn: number;
  user: ApiAuthUser;
}
export interface ApiHotel {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  currencyCode: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ApiHotelContext {
  id: string;
  name: string;
  currencyCode: "USD" | "SOS";
  timezone: string;
}
export interface ApiSystemUser {
  id: string;
  hotelId: string;
  email: string;
  username: string;
  fullName: string;
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: Array<{
    id: string;
    name: string;
    isSystem: boolean;
    isActive: boolean;
  }>;
}
export interface ApiRole {
  id: string;
  hotelId: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  deletedAt: string | null;
  userCount: number;
  permissions: Array<{ key: string; description: string | null }>;
  createdAt: string;
  updatedAt: string;
}
