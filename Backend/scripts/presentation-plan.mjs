// Deterministic presentation scenario. No database calls or writes.
export const PRESENTATION_CODE = 'PRESENTATION_MOG';
export const PRESENTATION_NAME = 'Jazeera Grand Hotel Mogadishu';

const categories = [
  { code: 'STDQ', name: 'Standard Queen', count: 18, price: 58, adults: 2, children: 1 },
  { code: 'STDT', name: 'Standard Twin', count: 14, price: 62, adults: 2, children: 1 },
  { code: 'DLXK', name: 'Deluxe King', count: 16, price: 89, adults: 2, children: 1 },
  { code: 'EXEK', name: 'Executive King', count: 10, price: 125, adults: 2, children: 1 },
  { code: 'JSTE', name: 'Junior Suite', count: 8, price: 165, adults: 3, children: 1 },
  { code: 'EXES', name: 'Executive Suite', count: 4, price: 235, adults: 3, children: 2 },
  { code: 'FAM', name: 'Family Room', count: 2, price: 148, adults: 4, children: 2 },
];

const firstNames = [
  'Amina',
  'Abdi',
  'Fadumo',
  'Yusuf',
  'Hodan',
  'Mohamed',
  'Sahra',
  'Ibrahim',
  'Maryan',
  'Ahmed',
  'Nasteho',
  'Khalid',
  'Zahra',
  'Hassan',
  'Farah',
  'Samira',
  'Omar',
  'Nimo',
  'Hamdi',
  'Ali',
  'Leila',
  'Noor',
  'Muna',
  'Jamal',
];
const lastNames = [
  'Warsame',
  'Jama',
  'Hussein',
  'Farah',
  'Ismail',
  'Osman',
  'Aden',
  'Roble',
  'Dahir',
  'Nur',
  'Mire',
  'Abdullahi',
  'Mohamud',
  'Hassan',
  'Yasin',
  'Abdi',
];
const internationalNames = [
  ['Grace Wanjiku', 'Kenya'],
  ['Daniel Otieno', 'Kenya'],
  ['Mekdes Tadesse', 'Ethiopia'],
  ['Abel Tesfaye', 'Ethiopia'],
  ['Aïcha Osman', 'Djibouti'],
  ['Kemal Demir', 'Turkey'],
  ['Elif Kaya', 'Turkey'],
  ['Fatima Al Mansoori', 'United Arab Emirates'],
  ['Omar Al Thani', 'Qatar'],
  ['Sara Al Harbi', 'Saudi Arabia'],
  ['James Bennett', 'United Kingdom'],
  ['Sofia Lindberg', 'Sweden'],
  ['Anders Johansen', 'Norway'],
  ['Lena Fischer', 'Germany'],
  ['Maya Johnson', 'United States'],
];

const services = [
  { name: 'Airport Transfer', price: 28 },
  { name: 'Laundry Service', price: 13 },
  { name: 'Restaurant Dining', price: 26 },
  { name: 'Minibar', price: 12 },
  { name: 'Extra Bed', price: 20 },
  { name: 'Late Checkout', price: 35 },
];
const expenseCatalog = [
  { name: 'Payroll & Benefits', base: 14500 },
  { name: 'Property Lease', base: 6500 },
  { name: 'Electricity', base: 2100 },
  { name: 'Water', base: 330 },
  { name: 'Internet & Software', base: 245 },
  { name: 'Food Supplies', base: 3600 },
  { name: 'Housekeeping Supplies', base: 215 },
  { name: 'Generator Fuel', base: 1500 },
  { name: 'Maintenance', base: 340 },
  { name: 'Staff Meals', base: 310 },
  { name: 'Security', base: 1200 },
  { name: 'Transportation', base: 95 },
  { name: 'Marketing', base: 205 },
  { name: 'Office Supplies', base: 75 },
  { name: 'Laundry Supplies', base: 125 },
  { name: 'Software Subscriptions', base: 120 },
  { name: 'Equipment & Fixtures', base: 385 },
];
const problems = [
  'Air conditioner not cooling efficiently',
  'Shower mixer leaking',
  'Door lock intermittently sticking',
  'Television signal drops',
  'Water heater temperature unstable',
  'Loose electrical socket',
  'Window latch needs adjustment',
  'Bathroom extractor fan noisy',
  'Mini fridge not cooling',
  'Bedside reading light replacement',
];

const date = (value) => value.toISOString().slice(0, 10);
const plusDays = (value, n) => new Date(value.getTime() + n * 86_400_000);
const monthStart = (value, offset) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + offset, 1));
const monthLength = (value) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();

export function buildPresentationPlan(referenceDate) {
  const today = new Date(`${referenceDate}T00:00:00.000Z`);
  if (Number.isNaN(today.getTime()) || date(today) !== referenceDate)
    throw new Error('A valid YYYY-MM-DD hotel business date is required.');
  const roomTypes = categories.map(({ count, ...value }) => value);
  const typeCodes = categories.flatMap(({ code, count }) => Array(count).fill(code));
  const rooms = typeCodes.map((typeCode, index) => ({
    key: `PRESENTATION_ROOM_${String(index + 1).padStart(3, '0')}`,
    number: `${Math.floor(index / 18) + 1}${String((index % 18) + 1).padStart(2, '0')}`,
    floor: Math.floor(index / 18) + 1,
    typeCode,
  }));
  const guests = Array.from({ length: 160 }, (_, index) => {
    const international =
      index >= 120 ? internationalNames[(index - 120) % internationalNames.length] : null;
    const fullName =
      international?.[0] ??
      `${firstNames[index % firstNames.length]} ${lastNames[Math.floor(index / firstNames.length) % lastNames.length]}`;
    return {
      key: `PRESENTATION_GUEST_${String(index + 1).padStart(3, '0')}`,
      fullName,
      nationality: international?.[1] ?? 'Somalia',
      email: `presentation.guest.${String(index + 1).padStart(3, '0')}@example.invalid`,
      phone: `+25261${String(5000000 + index).padStart(7, '0')}`,
      nationalId: `PRESENTATION-ID-${String(index + 1).padStart(5, '0')}`,
      address: international
        ? international[1]
        : ['Mogadishu', 'Hargeisa', 'Garowe', 'Kismayo'][index % 4],
    };
  });
  const reservations = [];
  const lengths = [17, 19, 21, 22];
  for (let monthIndex = 0; monthIndex < 4; monthIndex++) {
    const start = monthStart(today, monthIndex - 4);
    for (let roomIndex = 0; roomIndex < rooms.length; roomIndex++) {
      const day = 1 + ((roomIndex * 7 + monthIndex * 3) % 5);
      const arrival = plusDays(start, day - 1);
      const nights = Math.min(
        lengths[monthIndex] + (roomIndex % 7 === 0 ? 1 : 0),
        monthLength(start) - day,
      );
      reservations.push(
        reservation(
          rooms[roomIndex],
          guests,
          `H${monthIndex + 1}-${roomIndex + 1}`,
          'CHECKED_OUT',
          arrival,
          plusDays(arrival, nights),
          roomIndex + monthIndex * 72,
        ),
      );
    }
  }
  const availableToday = new Set(rooms.map((room) => room.number));
  for (let roomIndex = 0; roomIndex < 52; roomIndex++) {
    const back = Math.min(today.getUTCDate() - 1, 1 + (roomIndex % 9));
    const arrival = plusDays(today, -back);
    const departure = plusDays(today, roomIndex < 6 && back > 0 ? 0 : 2 + (roomIndex % 7));
    reservations.push(
      reservation(
        rooms[roomIndex],
        guests,
        `CURRENT-${roomIndex + 1}`,
        'CHECKED_IN',
        arrival,
        departure,
        roomIndex + 288,
      ),
    );
    availableToday.delete(rooms[roomIndex].number);
  }
  for (let roomIndex = 52; roomIndex < 56; roomIndex++) {
    reservations.push(
      reservation(
        rooms[roomIndex],
        guests,
        `ARRIVE-TODAY-${roomIndex}`,
        'CONFIRMED',
        today,
        plusDays(today, 2 + (roomIndex % 3)),
        roomIndex + 340,
      ),
    );
  }
  for (let roomIndex = 60; roomIndex < 64; roomIndex++) {
    const arrival = plusDays(today, -1);
    reservations.push(
      reservation(
        rooms[roomIndex],
        guests,
        `DEPART-TODAY-${roomIndex}`,
        'CHECKED_OUT',
        arrival,
        today,
        roomIndex + 344,
      ),
    );
  }
  for (let index = 0; index < 26; index++) {
    const roomIndex = 56 + (index % 16);
    const arrival = plusDays(today, 1 + Math.floor(index / 4) * 3);
    reservations.push(
      reservation(
        rooms[roomIndex],
        guests,
        `FUTURE-${index + 1}`,
        'CONFIRMED',
        arrival,
        plusDays(arrival, 2 + (index % 4)),
        index + 348,
      ),
    );
  }
  for (let index = 0; index < 16; index++) {
    const arrival = plusDays(today, 2 + index);
    reservations.push(
      reservation(
        rooms[(index * 3) % rooms.length],
        guests,
        `CANCELLED-${index + 1}`,
        'CANCELLED',
        arrival,
        plusDays(arrival, 2 + (index % 3)),
        index + 374,
      ),
    );
  }
  reservations.forEach((item, index) => {
    if (item.createdAt.slice(0, 10) > referenceDate) {
      item.createdAt = `${date(plusDays(today, -(1 + (index % 10))))}T10:00:00.000Z`;
    }
  });
  const expenses = Array.from({ length: 90 }, (_, index) => {
    const category = expenseCatalog[index % expenseCatalog.length];
    const month = monthStart(today, -4 + Math.floor(index / 18));
    const expenseDate = plusDays(month, 2 + ((index * 11) % Math.min(25, monthLength(month) - 3)));
    return {
      key: `PRESENTATION_EXPENSE_${String(index + 1).padStart(3, '0')}`,
      category: category.name,
      date: date(expenseDate > today ? today : expenseDate),
      amount: Math.round(category.base * (0.88 + ((index * 7) % 13) / 50) * 100) / 100,
      description: `${category.name} — ${month.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} operations`,
    };
  });
  const maintenance = Array.from({ length: 30 }, (_, index) => ({
    key: `PRESENTATION_MAINTENANCE_${String(index + 1).padStart(3, '0')}`,
    roomNumber: rooms[index >= 28 ? 68 + index - 28 : (index * 13 + 7) % rooms.length].number,
    problem: problems[index % problems.length],
    status: index >= 28 ? (index === 28 ? 'OPEN' : 'IN_PROGRESS') : 'CLOSED',
    date: date(plusDays(today, -145 + index * 5)),
  }));
  const plan = {
    referenceDate,
    hotel: {
      code: PRESENTATION_CODE,
      name: PRESENTATION_NAME,
      currencyCode: 'USD',
      timezone: 'Africa/Mogadishu',
    },
    roomTypes,
    rooms,
    guests,
    reservations,
    services,
    expenses,
    maintenance,
    availableToday: [...availableToday],
  };
  validatePresentationPlan(plan);
  return plan;
}

export function validatePresentationPlan(plan) {
  const roomNumbers = new Set(plan.rooms.map((room) => room.number));
  if (roomNumbers.size !== 72 || plan.guests.length !== 160)
    throw new Error('Presentation inventory or guest count changed unexpectedly.');
  const byRoom = new Map();
  const keys = new Set();
  for (const item of plan.reservations) {
    if (keys.has(item.key)) throw new Error(`Duplicate reservation marker ${item.key}`);
    keys.add(item.key);
    if (
      !roomNumbers.has(item.roomNumber) ||
      item.checkInDate >= item.checkOutDate ||
      item.createdAt.slice(0, 10) > item.checkInDate ||
      item.createdAt.slice(0, 10) > plan.referenceDate
    ) {
      throw new Error(`Invalid reservation ${item.key}`);
    }
    if (item.status === 'CHECKED_OUT' && item.checkOutDate > plan.referenceDate)
      throw new Error(`Future checkout ${item.key}`);
    if (
      item.status === 'CHECKED_IN' &&
      (item.checkInDate > plan.referenceDate || item.checkOutDate < plan.referenceDate)
    )
      throw new Error(`Current stay outside today ${item.key}`);
    if (item.status === 'CONFIRMED' && item.checkInDate < plan.referenceDate)
      throw new Error(`Past arrival still confirmed ${item.key}`);
    if (item.status === 'CANCELLED') continue;
    const schedule = byRoom.get(item.roomNumber) ?? [];
    schedule.push(item);
    byRoom.set(item.roomNumber, schedule);
  }
  for (const schedule of byRoom.values()) {
    schedule.sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
    for (let index = 1; index < schedule.length; index++) {
      if (schedule[index - 1].checkOutDate > schedule[index].checkInDate) {
        throw new Error(`Overlapping stays ${schedule[index - 1].key} and ${schedule[index].key}`);
      }
    }
  }
  return true;
}

function reservation(room, guests, key, status, arrival, departure, guestIndex) {
  const leadDays = 1 + ((guestIndex * 7) % 24);
  const created = plusDays(arrival, -leadDays);
  return {
    key: `PRESENTATION_${key}`,
    roomNumber: room.number,
    guestKey: guests[guestIndex % guests.length].key,
    status,
    checkInDate: date(arrival),
    checkOutDate: date(departure),
    createdAt: `${date(created)}T${String(8 + (guestIndex % 10)).padStart(2, '0')}:00:00.000Z`,
  };
}
