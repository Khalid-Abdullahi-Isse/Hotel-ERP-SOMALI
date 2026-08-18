export const queryKeys = {
  availability: (checkIn: string, checkOut: string, roomTypeId: string, adults: number, children: number) =>
    ["availability", checkIn, checkOut, roomTypeId, adults, children] as const,
  reservations: { all: ["reservations"] as const, detail: (id: string) => ["reservations", id] as const },
  rooms: { all: ["rooms"] as const, detail: (id: string) => ["rooms", id] as const },
  guests: { all: ["guests"] as const, detail: (id: string) => ["guests", id] as const },
  housekeeping: { all: ["housekeeping"] as const },
  payments: { all: ["payments"] as const },
  expenses: { all: ["expenses"] as const },
  reports: { all: ["reports"] as const },
} as const;
