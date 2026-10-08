import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { parse } from 'dotenv';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { ALL_PERMISSIONS, ROLE_PERMISSION_MATRIX } from '../src/auth/auth.constants.js';
import { AuditLogsService } from '../src/audit-logs/audit-logs.service.js';
import { FiscalPeriodsService } from '../src/accounting/fiscal-periods/fiscal-periods.service.js';
import { AccountingPostingService } from '../src/accounting/posting/accounting-posting.service.js';
import { AccountingSettingsService } from '../src/accounting/settings/accounting-settings.service.js';
import { GuestAccountingService } from '../src/accounting/guest-accounting.service.js';
import { ExpenseAccountingService } from '../src/accounting/expense-accounting.service.js';
import { buildPresentationPlan } from './presentation-plan.mjs';

const dryRun = process.argv.includes('--dry-run');
const validateOnly = process.argv.includes('--validate-only');
const compose = parse(readFileSync(fileURLToPath(new URL('../../.env', import.meta.url))));
for (const key of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']) {
  if (!compose[key]) throw new Error(`Root Compose .env must define ${key}`);
}
const port = Number(compose.POSTGRES_HOST_PORT ?? 5433);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('Invalid Compose PostgreSQL host port');
const url = `postgresql://${encodeURIComponent(compose.POSTGRES_USER)}:${encodeURIComponent(compose.POSTGRES_PASSWORD)}@127.0.0.1:${port}/${encodeURIComponent(compose.POSTGRES_DB)}?schema=public`;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
const audits = new AuditLogsService(prisma);
const periods = new FiscalPeriodsService(prisma, audits);
const posting = new AccountingPostingService(prisma, audits, periods);
const settingsService = new AccountingSettingsService(prisma, audits);
const guestAccounting = new GuestAccountingService(posting);
const expenseAccounting = new ExpenseAccountingService(posting);
const date = (value) => new Date(`${value}T00:00:00.000Z`);
const timestamp = (value, hour) => {
  const scheduled = new Date(`${value}T${String(hour).padStart(2, '0')}:00:00.000Z`);
  return scheduled > new Date() ? new Date() : scheduled;
};
const money = (value) => Number(value).toFixed(2);
const staff = [
  ['admin', 'Amina Hassan', 'ADMIN'],
  ['manager', 'Abdi Warsame', 'MANAGER'],
  ['frontdesk1', 'Fadumo Ali', 'STAFF'],
  ['frontdesk2', 'Yusuf Ahmed', 'STAFF'],
  ['accountant', 'Hodan Omar', 'MANAGER'],
  ['housekeeping.supervisor', 'Sahra Aden', 'MANAGER'],
  ['housekeeping1', 'Maryan Ismail', 'STAFF'],
  ['housekeeping2', 'Nasteho Farah', 'STAFF'],
  ['housekeeping3', 'Nimo Nur', 'STAFF'],
  ['housekeeping4', 'Leila Jama', 'STAFF'],
  ['maintenance.manager', 'Ibrahim Roble', 'MANAGER'],
  ['maintenance1', 'Mohamed Dahir', 'STAFF'],
  ['maintenance2', 'Khalid Osman', 'STAFF'],
];

function actorFor(user, hotelId) {
  return {
    id: user.id,
    hotelId,
    sessionId: randomUUID(),
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    roles: ['ADMIN'],
    permissions: ALL_PERMISSIONS,
  };
}
async function record(tx, actor, action, entityType, entityId, value, at) {
  await tx.auditLog.create({
    data: {
      hotelId: actor.hotelId,
      userId: actor.id,
      action,
      entityType,
      entityId,
      newValue: value,
      createdAt: at ?? new Date(),
    },
  });
}

async function main() {
  const hotelDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Mogadishu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const table = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."Hotel"')::text AS name`);
  const existing = table[0]?.name
    ? await prisma.hotel.findUnique({ where: { code: 'PRESENTATION_MOG' } })
    : null;
  const anchor = existing
    ? await prisma.auditLog.findFirst({
        where: {
          hotelId: existing.id,
          entityType: 'Hotel',
          entityId: existing.id,
          action: 'presentation.seed_anchor',
        },
        orderBy: { createdAt: 'asc' },
      })
    : null;
  if (existing && (!anchor || typeof anchor.newValue?.businessDate !== 'string')) {
    throw new Error(
      'Presentation hotel code exists without this seed’s anchor; refusing to modify it.',
    );
  }
  const plan = buildPresentationPlan(anchor?.newValue?.businessDate ?? hotelDate);
  const roomCharges = plan.reservations.filter((item) => item.status === 'CHECKED_OUT').length;
  const serviceCharges = plan.reservations.filter(
    (item, index) => ['CHECKED_OUT', 'CHECKED_IN'].includes(item.status) && index % 3 === 0,
  ).length;
  const guestPayments = plan.reservations.filter(
    (item, index) =>
      item.status === 'CHECKED_OUT' || (item.status === 'CHECKED_IN' && index % 2 === 0),
  ).length;
  const planned = {
    hotels: 1,
    users: staff.length,
    roomTypes: plan.roomTypes.length,
    rooms: plan.rooms.length,
    guests: plan.guests.length,
    reservations: plan.reservations.length,
    charges: roomCharges + serviceCharges,
    payments: guestPayments,
    expenses: plan.expenses.length,
    housekeeping: 57,
    maintenance: plan.maintenance.length,
  };
  if (!table[0]?.name) {
    if (dryRun) {
      console.log(
        JSON.stringify(
          {
            target: `${compose.POSTGRES_DB}@127.0.0.1:${port}`,
            hotelDate,
            schemaReady: false,
            planned,
            existing: null,
          },
          null,
          2,
        ),
      );
      return;
    }
    throw new Error(
      'Compose database has no Hotel table. Initialize the application schema before seeding.',
    );
  }
  const counts = existing ? await countsFor(existing.id) : null;
  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          target: `${compose.POSTGRES_DB}@127.0.0.1:${port}`,
          hotelDate,
          schemaReady: true,
          planned,
          existing: counts,
          anchoredBusinessDate: plan.referenceDate,
        },
        null,
        2,
      ),
    );
    return;
  }
  if (validateOnly) {
    if (!existing) throw new Error('Presentation hotel has not been seeded');
    console.log(JSON.stringify(await validate(existing.id, plan), null, 2));
    return;
  }
  if (process.env.ALLOW_PRESENTATION_SEED !== 'true')
    throw new Error('Presentation seed blocked. Set ALLOW_PRESENTATION_SEED=true explicitly.');
  const password = process.env.PRESENTATION_PASSWORD;
  if (!password || password.length < 12 || password.length > 128)
    throw new Error('PRESENTATION_PASSWORD must contain 12–128 characters.');
  if (existing && existing.name !== plan.hotel.name)
    throw new Error('Presentation hotel code belongs to another hotel; refusing to modify it.');
  if (existing) {
    const [admin, foreignReservations, foreignExpenses, foreignRooms] = await Promise.all([
      prisma.user.findUnique({ where: { username: 'presentation.admin' } }),
      prisma.reservation.count({
        where: { hotelId: existing.id, bookingNumber: { not: { startsWith: 'PRESENTATION_' } } },
      }),
      prisma.expense.count({
        where: {
          hotelId: existing.id,
          OR: [{ reference: null }, { reference: { not: { startsWith: 'PRESENTATION_' } } }],
        },
      }),
      prisma.room.count({
        where: {
          hotelId: existing.id,
          OR: [{ notes: null }, { notes: { not: { startsWith: 'PRESENTATION_ROOM_' } } }],
        },
      }),
    ]);
    if (admin?.hotelId !== existing.id || foreignReservations || foreignExpenses || foreignRooms) {
      throw new Error(
        'Presentation hotel contains records outside this seed; refusing to mix or modify them.',
      );
    }
  }
  if (
    existing &&
    counts &&
    (counts.rooms > 0 || counts.reservations > 0) &&
    counts.rooms !== plan.rooms.length
  ) {
    throw new Error('Presentation hotel contains unexpected room inventory; refusing to mix data.');
  }
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    hashLength: 32,
  });
  const setup = await setupHotel(plan, passwordHash);
  await settingsService.initialize(setup.actor);
  const master = await setupInventory(plan, setup);
  const frontDeskActors = ['frontdesk1', 'frontdesk2'].map((key) =>
    actorFor(setup.users.get(key), setup.hotel.id),
  );
  for (const [index, reservation] of plan.reservations.entries()) {
    await seedReservation(
      reservation,
      plan,
      frontDeskActors[index % frontDeskActors.length],
      master,
    );
    if ((index + 1) % 25 === 0)
      console.log(`Presentation reservations processed: ${index + 1}/${plan.reservations.length}`);
  }
  const accountant = actorFor(setup.users.get('accountant'), setup.hotel.id);
  for (const [index, expense] of plan.expenses.entries()) {
    await seedExpense(expense, accountant, master);
    if ((index + 1) % 20 === 0)
      console.log(`Presentation expenses processed: ${index + 1}/${plan.expenses.length}`);
  }
  const maintenanceManager = actorFor(setup.users.get('maintenance.manager'), setup.hotel.id);
  for (const request of plan.maintenance)
    await seedMaintenance(request, maintenanceManager, master);
  await seedHousekeepingAndStatus(
    plan,
    actorFor(setup.users.get('housekeeping.supervisor'), setup.hotel.id),
    master,
  );
  console.log(JSON.stringify(await validate(setup.hotel.id, plan), null, 2));
  console.log(
    'Presentation login: presentation.admin@example.invalid; password: value supplied as PRESENTATION_PASSWORD.',
  );
}

async function setupHotel(plan, passwordHash) {
  const openingAt = new Date(date(plan.reservations[0].checkInDate).getTime() - 30 * 86400000);
  return prisma.$transaction(
    async (tx) => {
      let hotel = await tx.hotel.findUnique({ where: { code: plan.hotel.code } });
      if (!hotel)
        hotel = await tx.hotel.create({
          data: {
            ...plan.hotel,
            address: 'KM4 District, Mogadishu, Somalia',
            phone: '+252 61 555 4100',
            email: 'reservations@example.invalid',
            createdAt: openingAt,
          },
        });
      const foreignUsers = await tx.user.count({
        where: { hotelId: hotel.id, email: { not: { endsWith: '@example.invalid' } } },
      });
      if (foreignUsers) throw new Error('Presentation hotel has users outside the seed marker');
      for (const key of ALL_PERMISSIONS)
        await tx.permission.upsert({ where: { key }, update: {}, create: { key } });
      const permissions = new Map(
        (await tx.permission.findMany({ where: { key: { in: ALL_PERMISSIONS } } })).map((item) => [
          item.key,
          item.id,
        ]),
      );
      const roles = new Map();
      for (const roleName of ['ADMIN', 'MANAGER', 'STAFF']) {
        let role = await tx.role.findUnique({
          where: { hotelId_name: { hotelId: hotel.id, name: roleName } },
        });
        if (role && !role.isSystem)
          throw new Error(`Presentation role ${roleName} is not a system role`);
        if (!role)
          role = await tx.role.create({
            data: { hotelId: hotel.id, name: roleName, isSystem: true, createdAt: openingAt },
          });
        roles.set(roleName, role.id);
        for (const key of ROLE_PERMISSION_MATRIX[roleName])
          await tx.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId: permissions.get(key) } },
            update: {},
            create: { roleId: role.id, permissionId: permissions.get(key) },
          });
      }
      const users = new Map();
      for (const [usernamePart, fullName, roleName] of staff) {
        const username = `presentation.${usernamePart}`;
        const email = `presentation.${usernamePart}@example.invalid`;
        let user = await tx.user.findUnique({ where: { username } });
        if (
          user &&
          (user.hotelId !== hotel.id || user.email !== email || user.fullName !== fullName)
        )
          throw new Error(`Seed username collision: ${username}`);
        if (!user) {
          const emailCollision = await tx.user.findUnique({ where: { email } });
          if (emailCollision) throw new Error(`Seed email collision: ${email}`);
          user = await tx.user.create({
            data: {
              hotelId: hotel.id,
              username,
              email,
              fullName,
              passwordHash,
              createdAt: openingAt,
            },
          });
          await record(tx, actorFor(user, hotel.id), 'user.create', 'User', user.id, {
            email,
            roleName,
          });
        }
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: roles.get(roleName) } },
          update: {},
          create: { userId: user.id, roleId: roles.get(roleName) },
        });
        users.set(usernamePart, user);
      }
      const actor = actorFor(users.get('admin'), hotel.id);
      const anchor = await tx.auditLog.findFirst({
        where: {
          hotelId: hotel.id,
          action: 'presentation.seed_anchor',
          entityType: 'Hotel',
          entityId: hotel.id,
        },
      });
      if (!anchor)
        await record(tx, actor, 'presentation.seed_anchor', 'Hotel', hotel.id, {
          businessDate: plan.referenceDate,
          code: plan.hotel.code,
        });
      return { hotel, actor, users };
    },
    { timeout: 120000 },
  );
}

async function setupInventory(plan, setup) {
  const hotelId = setup.hotel.id;
  const openingAt = new Date(date(plan.reservations[0].checkInDate).getTime() - 30 * 86400000);
  return prisma.$transaction(
    async (tx) => {
      const floors = new Map();
      for (let number = 1; number <= 4; number++) {
        const item = await tx.floor.upsert({
          where: { hotelId_number: { hotelId, number } },
          update: {},
          create: {
            hotelId,
            number,
            name: ['Lobby & Business', 'Garden View', 'Executive', 'Skyline'][number - 1],
            createdAt: openingAt,
          },
        });
        floors.set(number, item.id);
      }
      const types = new Map();
      for (const item of plan.roomTypes) {
        const value = await tx.roomType.upsert({
          where: { hotelId_code: { hotelId, code: item.code } },
          update: {},
          create: {
            hotelId,
            code: item.code,
            name: item.name,
            basePrice: money(item.price),
            capacityAdults: item.adults,
            capacityChildren: item.children,
            createdAt: openingAt,
          },
        });
        if (value.name !== item.name || Number(value.basePrice) !== item.price)
          throw new Error(`Room type collision: ${item.code}`);
        types.set(item.code, value);
      }
      const rooms = new Map();
      for (const item of plan.rooms) {
        const value = await tx.room.upsert({
          where: { hotelId_roomNumber: { hotelId, roomNumber: item.number } },
          update: {},
          create: {
            hotelId,
            floorId: floors.get(item.floor),
            roomTypeId: types.get(item.typeCode).id,
            roomNumber: item.number,
            notes: item.key,
            createdAt: openingAt,
          },
        });
        if (value.notes !== item.key || value.roomTypeId !== types.get(item.typeCode).id)
          throw new Error(`Room collision: ${item.number}`);
        rooms.set(item.number, value);
      }
      const guests = new Map();
      for (const item of plan.guests) {
        let value = await tx.guest.findFirst({ where: { hotelId, normalizedEmail: item.email } });
        if (!value)
          value = await tx.guest.create({
            data: {
              hotelId,
              fullName: item.fullName,
              email: item.email,
              normalizedEmail: item.email,
              phone: item.phone,
              normalizedPhone: item.phone,
              nationalId: item.nationalId,
              nationality: item.nationality,
              address: item.address,
              notes: item.key,
              createdAt: openingAt,
            },
          });
        if (value.notes !== item.key) throw new Error(`Guest collision: ${item.email}`);
        guests.set(item.key, value);
      }
      const settings = await tx.accountingSettings.findUniqueOrThrow({ where: { hotelId } });
      const serviceAccounts = new Map(
        (
          await tx.account.findMany({
            where: { hotelId, code: { in: ['4200', '4300', '4400', '4500'] } },
          })
        ).map((item) => [item.code, item.id]),
      );
      const services = new Map();
      for (const item of plan.services) {
        const accountCode =
          item.name === 'Laundry Service'
            ? '4300'
            : item.name === 'Airport Transfer'
              ? '4400'
              : item.name === 'Restaurant Dining'
                ? '4200'
                : '4500';
        const value = await tx.service.upsert({
          where: { hotelId_name: { hotelId, name: item.name } },
          update: {},
          create: {
            hotelId,
            name: item.name,
            defaultPrice: money(item.price),
            revenueAccountId: serviceAccounts.get(accountCode),
            createdAt: openingAt,
          },
        });
        services.set(item.name, value);
      }
      const methods = new Map();
      for (const [name, accountId] of [
        ['Cash', settings.defaultCashAccountId],
        ['Visa / Mastercard', settings.defaultBankAccountId],
        ['EVC Plus', settings.defaultMobileMoneyAccountId],
        ['Zaad', settings.defaultMobileMoneyAccountId],
        ['Bank Transfer', settings.defaultBankAccountId],
      ]) {
        const value = await tx.paymentMethod.upsert({
          where: { hotelId_name: { hotelId, name } },
          update: {},
          create: { hotelId, name, ledgerAccountId: accountId, createdAt: openingAt },
        });
        if (value.ledgerAccountId !== accountId)
          throw new Error(`Payment method collision: ${name}`);
        methods.set(name, value);
      }
      const expenseAccounts = new Map(
        (
          await tx.account.findMany({
            where: {
              hotelId,
              code: {
                in: ['6100', '6200', '6300', '6400', '6500', '6600', '6700', '6800', '6900'],
              },
            },
          })
        ).map((item) => [item.code, item.id]),
      );
      const categories = new Map();
      for (const name of [...new Set(plan.expenses.map((item) => item.category))]) {
        const code =
          name === 'Payroll & Benefits'
            ? '6100'
            : name === 'Property Lease'
              ? '6700'
              : name === 'Electricity' || name === 'Generator Fuel'
                ? '6200'
                : name === 'Water'
                  ? '6300'
                  : name.includes('Software') || name === 'Internet & Software'
                    ? '6400'
                    : name.includes('Housekeeping') || name.includes('Laundry')
                      ? '6500'
                      : name === 'Maintenance' || name === 'Equipment & Fixtures'
                        ? '6600'
                        : name === 'Marketing'
                          ? '6800'
                          : '6900';
        const value = await tx.expenseCategory.upsert({
          where: { hotelId_name: { hotelId, name } },
          update: {},
          create: {
            hotelId,
            name,
            expenseAccountId: expenseAccounts.get(code),
            createdAt: openingAt,
          },
        });
        categories.set(name, value);
      }
      return { rooms, types, guests, services, methods, categories };
    },
    { timeout: 180000 },
  );
}

async function seedReservation(item, plan, actor, master) {
  const hotelId = actor.hotelId;
  if (
    await prisma.reservation.findUnique({
      where: { hotelId_bookingNumber: { hotelId, bookingNumber: item.key } },
    })
  )
    return;
  await prisma.$transaction(
    async (tx) => {
      if (
        await tx.reservation.findUnique({
          where: { hotelId_bookingNumber: { hotelId, bookingNumber: item.key } },
        })
      )
        return;
      const room = master.rooms.get(item.roomNumber);
      const guest = master.guests.get(item.guestKey);
      const type = [...master.types.values()].find((value) => value.id === room.roomTypeId);
      const nights = Math.round((date(item.checkOutDate) - date(item.checkInDate)) / 86400000);
      const checkoutAt = timestamp(item.checkOutDate, 11);
      const checkinAt = timestamp(item.checkInDate, 15);
      const bookingAt = new Date(Math.min(new Date(item.createdAt).getTime(), Date.now()));
      const data = {
        hotelId,
        guestId: guest.id,
        bookingNumber: item.key,
        status: item.status,
        checkInDate: date(item.checkInDate),
        checkOutDate: date(item.checkOutDate),
        adults: type.capacityAdults,
        notes: 'Corporate and leisure guest stay',
        createdAt: bookingAt,
        ...(item.status === 'CHECKED_IN' || item.status === 'CHECKED_OUT'
          ? { checkedInAt: checkinAt }
          : {}),
        ...(item.status === 'CHECKED_OUT' ? { checkedOutAt: checkoutAt } : {}),
        ...(item.status === 'CANCELLED'
          ? { cancelledAt: new Date(), cancellationNote: 'Guest travel plans changed' }
          : {}),
      };
      const reservation = await tx.reservation.create({ data });
      const reservationRoom = await tx.reservationRoom.create({
        data: {
          reservationId: reservation.id,
          roomId: room.id,
          checkInDate: date(item.checkInDate),
          checkOutDate: date(item.checkOutDate),
          nightlyRate: type.basePrice,
          bookingStatus: item.status,
          createdAt: bookingAt,
        },
      });
      const transitions =
        item.status === 'CHECKED_OUT'
          ? ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT']
          : item.status === 'CHECKED_IN'
            ? ['PENDING', 'CONFIRMED', 'CHECKED_IN']
            : item.status === 'CANCELLED'
              ? ['PENDING', 'CONFIRMED', 'CANCELLED']
              : ['PENDING', 'CONFIRMED'];
      for (let index = 0; index < transitions.length; index++) {
        const changed =
          index < 2
            ? bookingAt
            : transitions[index] === 'CHECKED_IN'
              ? checkinAt
              : transitions[index] === 'CHECKED_OUT'
                ? checkoutAt
                : timestamp(plan.referenceDate, 18);
        await tx.reservationHistory.create({
          data: {
            reservationId: reservation.id,
            fromStatus: index ? transitions[index - 1] : null,
            toStatus: transitions[index],
            changedById: actor.id,
            createdAt: changed,
          },
        });
        await record(
          tx,
          actor,
          `reservation.${transitions[index].toLowerCase()}`,
          'Reservation',
          reservation.id,
          { bookingNumber: item.key, status: transitions[index] },
          changed,
        );
      }
      const charges = [];
      if (item.status === 'CHECKED_OUT') {
        const amount = Number(type.basePrice) * nights;
        const charge = await tx.charge.create({
          data: {
            reservationId: reservation.id,
            reservationRoomId: reservationRoom.id,
            type: 'ROOM',
            description: `Room ${room.roomNumber} — ${nights} nights`,
            quantity: nights,
            unitPrice: type.basePrice,
            totalAmount: money(amount),
            chargeDate: checkoutAt,
            createdAt: checkoutAt,
          },
        });
        await guestAccounting.postCharge(
          {
            id: charge.id,
            reservationId: reservation.id,
            amount: charge.totalAmount,
            occurredAt: charge.chargeDate,
            description: charge.description,
            type: 'ROOM',
          },
          actor,
          tx,
        );
        charges.push(charge);
      }
      const sequence = plan.reservations.findIndex((candidate) => candidate.key === item.key);
      if (['CHECKED_OUT', 'CHECKED_IN'].includes(item.status) && sequence % 3 === 0) {
        const service = [...master.services.values()][sequence % master.services.size];
        const when =
          item.status === 'CHECKED_IN'
            ? timestamp(plan.referenceDate, 10)
            : timestamp(item.checkOutDate, 9);
        const charge = await tx.charge.create({
          data: {
            reservationId: reservation.id,
            serviceId: service.id,
            type: 'SERVICE',
            description: service.name,
            quantity: 1,
            unitPrice: service.defaultPrice,
            totalAmount: service.defaultPrice,
            chargeDate: when,
            createdAt: when,
          },
        });
        await guestAccounting.postCharge(
          {
            id: charge.id,
            reservationId: reservation.id,
            amount: charge.totalAmount,
            occurredAt: when,
            description: service.name,
            type: 'SERVICE',
            revenueAccountId: service.revenueAccountId,
          },
          actor,
          tx,
        );
        charges.push(charge);
      }
      const total = charges.reduce((sum, charge) => sum + Number(charge.totalAmount), 0);
      if (item.status === 'CHECKED_OUT') {
        const invoice = await tx.invoice.create({
          data: {
            hotelId,
            reservationId: reservation.id,
            invoiceNumber: `INV-${item.key}`,
            status: sequence % 11 === 0 ? 'PARTIALLY_PAID' : 'PAID',
            subtotal: money(total),
            totalAmount: money(total),
            issuedAt: checkoutAt,
            issuedById: actor.id,
            createdAt: checkoutAt,
          },
        });
        for (const charge of charges)
          await tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              chargeId: charge.id,
              description: charge.description,
              quantity: charge.quantity,
              unitPrice: charge.unitPrice,
              amount: charge.totalAmount,
              createdAt: checkoutAt,
            },
          });
        const amount = money(sequence % 11 === 0 ? total * 0.55 : total);
        await createPayment(tx, actor, reservation, invoice, master, amount, checkoutAt, sequence);
      } else if (item.status === 'CHECKED_IN' && sequence % 2 === 0) {
        const projected = Number(type.basePrice) * nights + total;
        await createPayment(
          tx,
          actor,
          reservation,
          null,
          master,
          money(projected * 0.3),
          timestamp(plan.referenceDate, 11),
          sequence,
        );
      }
      if (item.status === 'CHECKED_IN')
        await tx.room.update({ where: { id: room.id }, data: { status: 'OCCUPIED' } });
    },
    { timeout: 120000 },
  );
}

async function createPayment(tx, actor, reservation, invoice, master, amount, at, sequence) {
  const method = [...master.methods.values()][sequence % master.methods.size];
  const payment = await tx.payment.create({
    data: {
      hotelId: actor.hotelId,
      reservationId: reservation.id,
      invoiceId: invoice?.id,
      guestId: reservation.guestId,
      paymentMethodId: method.id,
      createdById: actor.id,
      requestKey: randomUUID(),
      amount,
      kind: 'PAYMENT',
      status: 'COMPLETED',
      reference: `PRESENTATION-${sequence + 1}`,
      paidAt: at,
      createdAt: at,
    },
  });
  await guestAccounting.postPayment(
    {
      id: payment.id,
      reservationId: reservation.id,
      amount: payment.amount,
      occurredAt: at,
      reference: payment.reference,
      description: `Guest payment for ${reservation.bookingNumber}`,
      paymentAccountId: method.ledgerAccountId,
    },
    actor,
    tx,
  );
  await record(
    tx,
    actor,
    'payment.create',
    'Payment',
    payment.id,
    { reservationId: reservation.id, amount, method: method.name },
    at,
  );
}

async function seedExpense(item, actor, master) {
  if (await prisma.expense.findFirst({ where: { hotelId: actor.hotelId, reference: item.key } }))
    return;
  await prisma.$transaction(
    async (tx) => {
      if (await tx.expense.findFirst({ where: { hotelId: actor.hotelId, reference: item.key } }))
        return;
      const category = master.categories.get(item.category);
      const method = master.methods.get(
        ['Cash', 'EVC Plus', 'Bank Transfer'][item.key.charCodeAt(item.key.length - 1) % 3],
      );
      const at = timestamp(item.date, 13);
      const expense = await tx.expense.create({
        data: {
          hotelId: actor.hotelId,
          categoryId: category.id,
          paymentMethodId: method.id,
          createdById: actor.id,
          approvedById: actor.id,
          paidById: actor.id,
          requestKey: randomUUID(),
          status: 'PAID',
          amount: money(item.amount),
          expenseDate: date(item.date),
          description: item.description,
          reference: item.key,
          submittedAt: at,
          approvedAt: at,
          paidAt: at,
          createdAt: at,
        },
      });
      await expenseAccounting.postExpense(
        {
          id: expense.id,
          amount: expense.amount,
          expenseDate: expense.expenseDate,
          description: expense.description,
          reference: expense.reference,
          expenseAccountId: category.expenseAccountId,
          paymentAccountId: method.ledgerAccountId,
          hasPaymentMethod: true,
        },
        actor,
        tx,
      );
      await record(
        tx,
        actor,
        'expense.create',
        'Expense',
        expense.id,
        { amount: item.amount, category: item.category },
        at,
      );
      await record(tx, actor, 'expense.approve', 'Expense', expense.id, { status: 'APPROVED' }, at);
      await record(tx, actor, 'expense.pay', 'Expense', expense.id, { status: 'PAID' }, at);
    },
    { timeout: 120000 },
  );
}

async function seedMaintenance(item, actor, master) {
  if (
    await prisma.maintenanceRequest.findFirst({
      where: { hotelId: actor.hotelId, notes: item.key },
    })
  )
    return;
  await prisma.$transaction(async (tx) => {
    if (
      await tx.maintenanceRequest.findFirst({ where: { hotelId: actor.hotelId, notes: item.key } })
    )
      return;
    const room = master.rooms.get(item.roomNumber);
    const at = timestamp(item.date, 10);
    const closed = item.status === 'CLOSED';
    const open = item.status === 'OPEN';
    const request = await tx.maintenanceRequest.create({
      data: {
        hotelId: actor.hotelId,
        roomId: room.id,
        createdById: actor.id,
        assignedToId: open ? null : actor.id,
        problem: item.problem,
        category: 'Guest room repair',
        priority: 'MEDIUM',
        status: item.status,
        notes: item.key,
        assignedAt: open ? null : at,
        startedAt: open ? null : at,
        completedAt: closed ? timestamp(item.date, 14) : null,
        completedById: closed ? actor.id : null,
        verifiedAt: closed ? timestamp(item.date, 15) : null,
        verifiedById: closed ? actor.id : null,
        closedAt: closed ? timestamp(item.date, 16) : null,
        closedById: closed ? actor.id : null,
        previousRoomStatus: open ? null : 'AVAILABLE',
        createdAt: at,
      },
    });
    await record(
      tx,
      actor,
      'maintenance.create',
      'MaintenanceRequest',
      request.id,
      { roomId: room.id, status: 'OPEN', problem: item.problem },
      at,
    );
    if (closed)
      await record(
        tx,
        actor,
        'maintenance.close',
        'MaintenanceRequest',
        request.id,
        { roomId: room.id, status: 'CLOSED' },
        timestamp(item.date, 16),
      );
  });
}

async function seedHousekeepingAndStatus(plan, actor, master) {
  await prisma.$transaction(
    async (tx) => {
      const already = await tx.housekeepingTask.count({ where: { hotelId: actor.hotelId } });
      if (already) return;
      const historical = plan.reservations
        .filter((item) => item.status === 'CHECKED_OUT' && item.checkOutDate < plan.referenceDate)
        .slice(-50);
      for (const item of historical) {
        const reservation = await tx.reservation.findUniqueOrThrow({
          where: { hotelId_bookingNumber: { hotelId: actor.hotelId, bookingNumber: item.key } },
        });
        const at = timestamp(item.checkOutDate, 12);
        await tx.housekeepingTask.create({
          data: {
            hotelId: actor.hotelId,
            roomId: master.rooms.get(item.roomNumber).id,
            reservationId: reservation.id,
            assignedToId: actor.id,
            status: 'COMPLETED',
            notes: 'Checkout cleaning and inspection completed',
            startedAt: at,
            completedAt: timestamp(item.checkOutDate, 14),
            createdAt: at,
          },
        });
      }
      for (let index = 60; index < 67; index++) {
        const status = index < 64 ? 'DIRTY' : 'CLEANING';
        const room = master.rooms.get(plan.rooms[index].number);
        const recent =
          index < 64
            ? await tx.reservation.findUniqueOrThrow({
                where: {
                  hotelId_bookingNumber: {
                    hotelId: actor.hotelId,
                    bookingNumber: `PRESENTATION_DEPART-TODAY-${index}`,
                  },
                },
              })
            : null;
        await tx.room.update({ where: { id: room.id }, data: { status } });
        const task = await tx.housekeepingTask.create({
          data: {
            hotelId: actor.hotelId,
            roomId: room.id,
            reservationId: recent?.id,
            assignedToId: actor.id,
            status,
            notes:
              index === 66
                ? 'Deep cleaning and linen replacement'
                : recent
                  ? 'Checkout cleaning required'
                  : 'Guest room service',
            startedAt: status === 'CLEANING' ? new Date() : null,
          },
        });
        await record(tx, actor, 'housekeeping.task_created', 'HousekeepingTask', task.id, {
          roomId: room.id,
          status,
        });
      }
      for (const index of [69])
        await tx.room.update({
          where: { id: master.rooms.get(plan.rooms[index].number).id },
          data: { status: 'MAINTENANCE' },
        });
    },
    { timeout: 120000 },
  );
}

async function countsFor(hotelId) {
  const [
    users,
    rooms,
    guests,
    reservations,
    charges,
    payments,
    expenses,
    maintenance,
    housekeeping,
    journals,
  ] = await Promise.all([
    prisma.user.count({ where: { hotelId } }),
    prisma.room.count({ where: { hotelId } }),
    prisma.guest.count({ where: { hotelId } }),
    prisma.reservation.count({ where: { hotelId } }),
    prisma.charge.count({ where: { reservation: { hotelId } } }),
    prisma.payment.count({ where: { hotelId } }),
    prisma.expense.count({ where: { hotelId } }),
    prisma.maintenanceRequest.count({ where: { hotelId } }),
    prisma.housekeepingTask.count({ where: { hotelId } }),
    prisma.journalEntry.count({ where: { hotelId } }),
  ]);
  return {
    users,
    rooms,
    guests,
    reservations,
    charges,
    payments,
    expenses,
    maintenance,
    housekeeping,
    journals,
  };
}

async function validate(hotelId, plan) {
  const counts = await countsFor(hotelId);
  for (const [field, expected] of [
    ['users', staff.length],
    ['rooms', 72],
    ['guests', 160],
    ['reservations', plan.reservations.length],
    ['expenses', 90],
    ['maintenance', 30],
    ['housekeeping', 57],
  ]) {
    if (counts[field] !== expected)
      throw new Error(`${field}: expected ${expected}, found ${counts[field]}`);
  }
  const unbalanced = await prisma.$queryRaw`SELECT count(*)::int AS count FROM (
    SELECT je.id FROM "JournalEntry" je JOIN "JournalLine" jl ON jl."journalEntryId"=je.id
    WHERE je."hotelId"=${hotelId}::uuid GROUP BY je.id HAVING sum(jl.debit)<>sum(jl.credit)) q`;
  if (unbalanced[0].count) throw new Error(`${unbalanced[0].count} unbalanced journal entries`);
  const overlaps = await prisma.$queryRaw`SELECT count(*)::int AS count FROM "ReservationRoom" a
    JOIN "ReservationRoom" b ON a."roomId"=b."roomId" AND a.id<b.id AND
      a."checkInDate"<b."checkOutDate" AND b."checkInDate"<a."checkOutDate"
    JOIN "Reservation" r ON r.id=a."reservationId" WHERE r."hotelId"=${hotelId}::uuid
    AND a."bookingStatus" NOT IN ('CANCELLED','NO_SHOW') AND b."bookingStatus" NOT IN ('CANCELLED','NO_SHOW')`;
  if (overlaps[0].count) throw new Error(`${overlaps[0].count} overlapping room stays`);
  const invalidDates = await prisma.$queryRaw`SELECT count(*)::int AS count FROM "Reservation" r
    WHERE r."hotelId"=${hotelId}::uuid AND (r."checkInDate">=r."checkOutDate" OR
      r."createdAt"::date>r."checkInDate")`;
  if (invalidDates[0].count) throw new Error(`${invalidDates[0].count} invalid reservation dates`);
  const unmatchedOccupancy =
    await prisma.$queryRaw`SELECT count(*)::int AS count FROM "ReservationRoom" rr
    JOIN "Reservation" r ON r.id=rr."reservationId" JOIN "Room" room ON room.id=rr."roomId"
    WHERE r."hotelId"=${hotelId}::uuid AND r.status='CHECKED_IN' AND room.status<>'OCCUPIED'`;
  if (unmatchedOccupancy[0].count)
    throw new Error(`${unmatchedOccupancy[0].count} checked-in rooms are not occupied`);
  const unpaidOverpayments = await prisma.$queryRaw`SELECT count(*)::int AS count FROM (
    SELECT i.id FROM "Invoice" i LEFT JOIN "Payment" p ON p."invoiceId"=i.id AND p.status='COMPLETED'
    WHERE i."hotelId"=${hotelId}::uuid GROUP BY i.id,i."totalAmount"
    HAVING coalesce(sum(CASE WHEN p.kind='PAYMENT' THEN p.amount ELSE -p.amount END),0)>i."totalAmount") q`;
  if (unpaidOverpayments[0].count)
    throw new Error(`${unpaidOverpayments[0].count} invoices are overpaid`);
  const housekeepingMismatch =
    await prisma.$queryRaw`SELECT count(*)::int AS count FROM "HousekeepingTask" h
    JOIN "Room" r ON r.id=h."roomId" WHERE h."hotelId"=${hotelId}::uuid
    AND h.status IN ('DIRTY','CLEANING') AND h.status::text<>r.status::text`;
  if (housekeepingMismatch[0].count)
    throw new Error(`${housekeepingMismatch[0].count} active housekeeping room states disagree`);
  const maintenanceMismatch =
    await prisma.$queryRaw`SELECT count(*)::int AS count FROM "MaintenanceRequest" m
    JOIN "Room" r ON r.id=m."roomId" WHERE m."hotelId"=${hotelId}::uuid
    AND m.status='IN_PROGRESS' AND r.status<>'MAINTENANCE'`;
  if (maintenanceMismatch[0].count)
    throw new Error(`${maintenanceMismatch[0].count} maintenance room states disagree`);
  const missingAuditEntities =
    await prisma.$queryRaw`SELECT count(*)::int AS count FROM "AuditLog" a
    WHERE a."hotelId"=${hotelId}::uuid AND (
      (a."entityType"='Reservation' AND NOT EXISTS(SELECT 1 FROM "Reservation" x WHERE x.id=a."entityId")) OR
      (a."entityType"='Payment' AND NOT EXISTS(SELECT 1 FROM "Payment" x WHERE x.id=a."entityId")) OR
      (a."entityType"='Expense' AND NOT EXISTS(SELECT 1 FROM "Expense" x WHERE x.id=a."entityId")) OR
      (a."entityType"='MaintenanceRequest' AND NOT EXISTS(SELECT 1 FROM "MaintenanceRequest" x WHERE x.id=a."entityId")) OR
      (a."entityType"='HousekeepingTask' AND NOT EXISTS(SELECT 1 FROM "HousekeepingTask" x WHERE x.id=a."entityId")) OR
      (a."entityType"='JournalEntry' AND NOT EXISTS(SELECT 1 FROM "JournalEntry" x WHERE x.id=a."entityId")))`;
  if (missingAuditEntities[0].count)
    throw new Error(`${missingAuditEntities[0].count} audit logs reference missing entities`);
  const roomStates = await prisma.room.groupBy({
    by: ['status'],
    where: { hotelId },
    _count: true,
  });
  const reservationStates = await prisma.reservation.groupBy({
    by: ['status'],
    where: { hotelId },
    _count: true,
  });
  return {
    hotel: plan.hotel.name,
    businessDate: plan.referenceDate,
    counts,
    balancedJournals: true,
    overlappingStays: 0,
    invalidReservations: 0,
    overpayments: 0,
    housekeepingMismatches: 0,
    maintenanceMismatches: 0,
    missingAuditEntities: 0,
    roomStates,
    reservationStates,
  };
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
