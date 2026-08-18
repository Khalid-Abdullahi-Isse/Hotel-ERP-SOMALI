import { BadRequestException } from '@nestjs/common';

export interface StayDates {
  checkIn: Date;
  checkOut: Date;
  nights: number;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function parseStayDates(checkInValue: string, checkOutValue: string): StayDates {
  const checkIn = parseDateOnly(checkInValue, 'checkInDate');
  const checkOut = parseDateOnly(checkOutValue, 'checkOutDate');
  const nights = (checkOut.getTime() - checkIn.getTime()) / DAY_MS;
  if (!Number.isInteger(nights) || nights < 1) {
    throw new BadRequestException({
      code: 'INVALID_STAY_DATES',
      message: 'Check-out must be after check-in.',
    });
  }
  if (nights > 365) {
    throw new BadRequestException({
      code: 'STAY_TOO_LONG',
      message: 'A reservation cannot exceed 365 nights.',
    });
  }
  return { checkIn, checkOut, nights };
}

export function currentDateInTimeZone(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function parseDateOnly(value: string, field: string): Date {
  if (!DATE_PATTERN.test(value)) invalidDate(field);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    invalidDate(field);
  }
  return date;
}

function invalidDate(field: string): never {
  throw new BadRequestException({
    code: 'INVALID_CALENDAR_DATE',
    message: `${field} must be a real calendar date in YYYY-MM-DD format.`,
  });
}
