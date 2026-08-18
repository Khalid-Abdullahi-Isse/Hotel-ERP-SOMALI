import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const json = (value) => JSON.stringify(value, null, 2);
const body = (value) => ({ mode: 'raw', raw: json(value), options: { raw: { language: 'json' } } });
const queryPath = (path, query = {}) => {
  const entries = Object.entries(query);
  if (!entries.length) return path;
  return `${path}?${entries.map(([key, value]) => `${key}=${value}`).join('&')}`;
};

const commonTests = [
  "pm.test('Status is successful', () => pm.expect(pm.response.code).to.be.oneOf([200, 201, 202, 204]));",
  "pm.test('Response time is under 5 seconds', () => pm.expect(pm.response.responseTime).to.be.below(5000));",
  "if (pm.response.code !== 204) pm.test('Response is JSON', () => pm.response.to.be.json);",
];

function request(name, method, path, options = {}) {
  const scripts = [...commonTests];
  if (options.save) {
    const parts = options.save.path.split('.');
    scripts.push(
      `if (pm.response.code >= 200 && pm.response.code < 300) { const value = ${parts.reduce((a, p) => `${a}[${JSON.stringify(p)}]`, 'pm.response.json()')}; if (value) pm.collectionVariables.set(${JSON.stringify(options.save.variable)}, value); }`,
    );
  }
  if (options.testScript) scripts.push(...options.testScript);
  const headers = [...(options.headers ?? [])];
  if (options.body !== undefined || options.rawBody !== undefined)
    headers.push({ key: 'Content-Type', value: 'application/json' });
  const req = {
    method,
    header: headers,
    url: `{{baseUrl}}${path}`,
  };
  if (options.rawBody !== undefined)
    req.body = { mode: 'raw', raw: options.rawBody, options: { raw: { language: 'json' } } };
  else if (options.body !== undefined) req.body = body(options.body);
  if (options.noAuth) req.auth = { type: 'noauth' };
  return {
    name,
    request: req,
    response: [],
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: scripts } }],
  };
}

const folder = (name, item, description) => ({ name, description, item });

const collection = {
  info: {
    _postman_id: '905c1362-3bce-4a62-9dc7-0464940faee8',
    name: 'Somali Hotel ERP Backend - Complete API',
    description:
      'Complete Postman coverage for every NestJS controller endpoint. Run folders in order for the integrated workflow. Login stores the bearer token; Postman stores the HttpOnly refresh cookie automatically. Create requests capture IDs into collection variables. Mutating requests require an ADMIN bootstrap account for full coverage.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{accessToken}}', type: 'string' }] },
  event: [
    {
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [
          'const iso = (offset) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); };',
          "pm.collectionVariables.set('today', iso(0));",
          "pm.collectionVariables.set('tomorrow', iso(1));",
          "pm.collectionVariables.set('dayAfterTomorrow', iso(2));",
          "pm.collectionVariables.set('reportFrom', iso(-30));",
          "pm.collectionVariables.set('reportTo', iso(30));",
        ],
      },
    },
  ],
  variable: [
    ['accessToken', ''],
    ['floorId', ''],
    ['deletableFloorId', ''],
    ['roomTypeId', ''],
    ['deletableRoomTypeId', ''],
    ['roomId', ''],
    ['secondRoomId', ''],
    ['guestId', ''],
    ['reservationId', ''],
    ['cancelReservationId', ''],
    ['noShowReservationId', ''],
    ['serviceId', ''],
    ['chargeId', ''],
    ['paymentMethodId', ''],
    ['paymentId', ''],
    ['invoiceId', ''],
    ['expenseCategoryId', ''],
    ['expenseId', ''],
    ['housekeepingTaskId', ''],
    ['maintenanceId', ''],
    ['customRoleId', ''],
    ['deletableRoleId', ''],
    ['staffRoleId', ''],
    ['userId', ''],
    ['auditId', ''],
    ['today', ''],
    ['tomorrow', ''],
    ['dayAfterTomorrow', ''],
    ['reportFrom', ''],
    ['reportTo', ''],
    ['floorNumber', ''],
    ['deletableFloorNumber', ''],
  ].map(([key, value]) => ({ key, value, type: 'string' })),
  item: [],
};

collection.item.push(
  folder('01 - Health and Authentication', [
    request('Liveness', 'GET', '/health/live', { noAuth: true }),
    request('Readiness', 'GET', '/health/ready', { noAuth: true }),
    request('Operational Metrics', 'GET', '/health/metrics', {
      noAuth: true,
      headers: [{ key: 'X-Monitoring-Token', value: '{{monitoringToken}}' }],
    }),
    request('Login', 'POST', '/auth/login', {
      noAuth: true,
      body: { identifier: '{{adminIdentifier}}', password: '{{adminPassword}}' },
      save: { variable: 'accessToken', path: 'accessToken' },
      testScript: [
        "pm.test('Access token returned', () => pm.expect(pm.response.json().accessToken).to.be.a('string').and.not.empty);",
      ],
    }),
    request('Current User', 'GET', '/auth/me'),
    request('Refresh Access Token', 'POST', '/auth/refresh', {
      noAuth: true,
      save: { variable: 'accessToken', path: 'accessToken' },
    }),
    request('Logout Current Session', 'POST', '/auth/logout'),
    request('Login Again', 'POST', '/auth/login', {
      noAuth: true,
      body: { identifier: '{{adminIdentifier}}', password: '{{adminPassword}}' },
      save: { variable: 'accessToken', path: 'accessToken' },
    }),
    request('Logout All Sessions', 'POST', '/auth/logout-all'),
    request('Final Login for Remaining Folders', 'POST', '/auth/login', {
      noAuth: true,
      body: { identifier: '{{adminIdentifier}}', password: '{{adminPassword}}' },
      save: { variable: 'accessToken', path: 'accessToken' },
    }),
  ]),

  folder('02 - Hotel, Roles, and Users', [
    request('Get Current Hotel', 'GET', '/hotels/current'),
    request('Update Current Hotel', 'PATCH', '/hotels/current', {
      body: { phone: '+252 61 0000000', currencyCode: 'USD', timezone: 'Africa/Mogadishu' },
    }),
    request('List Permissions', 'GET', '/roles/permissions'),
    request('List Roles and Capture STAFF', 'GET', '/roles', {
      testScript: [
        "const roles = pm.response.json(); const staff = roles.find((r) => r.name === 'STAFF'); if (staff) pm.collectionVariables.set('staffRoleId', staff.id);",
        "pm.test('STAFF role is available', () => pm.expect(pm.collectionVariables.get('staffRoleId')).to.be.ok);",
      ],
    }),
    request('Create Custom Role', 'POST', '/roles', {
      body: {
        name: 'POSTMAN SUPERVISOR {{$timestamp}}',
        description: 'Created by Postman API tests',
        permissionKeys: ['room.view', 'guest.view', 'reservation.view'],
      },
      save: { variable: 'customRoleId', path: 'id' },
    }),
    request('Get Roles', 'GET', '/roles'),
    request('Update Custom Role', 'PATCH', '/roles/{{customRoleId}}', {
      body: { description: 'Updated by the complete Postman collection' },
    }),
    request('Replace Custom Role Permissions', 'PUT', '/roles/{{customRoleId}}/permissions', {
      body: {
        permissionKeys: ['room.view', 'guest.view', 'reservation.view', 'availability.view'],
      },
    }),
    request('Create Deletable Role', 'POST', '/roles', {
      body: {
        name: 'POSTMAN TEMP {{$timestamp}}',
        description: 'Safe role deactivation test',
        permissionKeys: [],
      },
      save: { variable: 'deletableRoleId', path: 'id' },
    }),
    request('Deactivate Unused Custom Role', 'DELETE', '/roles/{{deletableRoleId}}'),
    request('Create User', 'POST', '/users', {
      body: {
        email: 'postman+{{$timestamp}}@example.com',
        username: 'postman_{{$timestamp}}',
        fullName: 'Postman Test User',
        password: 'PostmanTest!12345',
        roleIds: ['{{staffRoleId}}'],
      },
      save: { variable: 'userId', path: 'id' },
    }),
    request('List Users', 'GET', '/users'),
    request('Get User', 'GET', '/users/{{userId}}'),
    request('Update User', 'PATCH', '/users/{{userId}}', {
      body: { fullName: 'Postman Test User Updated' },
    }),
    request('Assign User Roles', 'PUT', '/users/{{userId}}/roles', {
      body: { roleIds: ['{{staffRoleId}}', '{{customRoleId}}'] },
    }),
    request('Reset User Password', 'POST', '/users/{{userId}}/reset-password', {
      body: { password: 'PostmanReset!12345' },
    }),
    request('Unlock User', 'PATCH', '/users/{{userId}}/unlock'),
    request('Deactivate User', 'DELETE', '/users/{{userId}}'),
    request('Restore User', 'PATCH', '/users/{{userId}}/restore'),
  ]),

  folder('03 - Floors, Room Types, and Rooms', [
    request('List Floors and Choose Test Numbers', 'GET', '/floors', {
      testScript: [
        "const used = new Set(pm.response.json().map((floor) => floor.number)); const free = []; for (let n = 300; n >= -20 && free.length < 2; n -= 1) if (!used.has(n)) free.push(n); pm.expect(free.length, 'two unused floor numbers').to.equal(2); pm.collectionVariables.set('floorNumber', free[0]); pm.collectionVariables.set('deletableFloorNumber', free[1]);",
      ],
    }),
    request('Create Floor', 'POST', '/floors', {
      rawBody: '{\n  "number": {{floorNumber}},\n  "name": "Postman Integration Floor"\n}',
      save: { variable: 'floorId', path: 'id' },
    }),
    request('Get Floor', 'GET', '/floors/{{floorId}}'),
    request('Update Floor', 'PATCH', '/floors/{{floorId}}', {
      body: { name: 'Postman Integration Floor Updated' },
    }),
    request('Create Empty Floor', 'POST', '/floors', {
      rawBody: '{\n  "number": {{deletableFloorNumber}},\n  "name": "Postman Deletion Test"\n}',
      save: { variable: 'deletableFloorId', path: 'id' },
    }),
    request('Delete Empty Floor', 'DELETE', '/floors/{{deletableFloorId}}'),
    request('Create Room Type', 'POST', '/room-types', {
      body: {
        code: 'PM{{$timestamp}}',
        name: 'Postman Standard',
        description: 'Integration test room type',
        capacityAdults: 2,
        capacityChildren: 1,
        basePrice: '100.00',
      },
      save: { variable: 'roomTypeId', path: 'id' },
    }),
    request('List Room Types', 'GET', '/room-types'),
    request('Get Room Type', 'GET', '/room-types/{{roomTypeId}}'),
    request('Update Room Type', 'PATCH', '/room-types/{{roomTypeId}}', {
      body: { basePrice: '110.00', description: 'Updated integration test room type' },
    }),
    request('Create Deactivatable Room Type', 'POST', '/room-types', {
      body: {
        code: 'DEL{{$timestamp}}',
        name: 'Postman Temporary Type',
        capacityAdults: 1,
        capacityChildren: 0,
        basePrice: '50.00',
      },
      save: { variable: 'deletableRoomTypeId', path: 'id' },
    }),
    request('Deactivate Unused Room Type', 'DELETE', '/room-types/{{deletableRoomTypeId}}'),
    request('Restore Room Type', 'PATCH', '/room-types/{{deletableRoomTypeId}}/restore'),
    request('Create Primary Room', 'POST', '/rooms', {
      body: {
        roomNumber: 'P{{$timestamp}}A',
        roomTypeId: '{{roomTypeId}}',
        floorId: '{{floorId}}',
        notes: 'Primary Postman workflow room',
      },
      save: { variable: 'roomId', path: 'id' },
    }),
    request('Create Secondary Room', 'POST', '/rooms', {
      body: {
        roomNumber: 'P{{$timestamp}}B',
        roomTypeId: '{{roomTypeId}}',
        floorId: '{{floorId}}',
        notes: 'Secondary lifecycle room',
      },
      save: { variable: 'secondRoomId', path: 'id' },
    }),
    request(
      'List Rooms with Filters',
      'GET',
      queryPath('/rooms', {
        page: 1,
        pageSize: 25,
        search: 'P',
        floorId: '{{floorId}}',
        roomTypeId: '{{roomTypeId}}',
        status: 'AVAILABLE',
        isActive: 'true',
      }),
    ),
    request('Get Room', 'GET', '/rooms/{{roomId}}'),
    request('Update Room', 'PATCH', '/rooms/{{roomId}}', {
      body: { notes: 'Updated by Postman complete endpoint suite' },
    }),
    request('Set Room to Maintenance', 'PATCH', '/rooms/{{secondRoomId}}/status', {
      body: { status: 'MAINTENANCE' },
    }),
    request('Set Room Back to Available', 'PATCH', '/rooms/{{secondRoomId}}/status', {
      body: { status: 'AVAILABLE' },
    }),
    request('Deactivate Secondary Room', 'DELETE', '/rooms/{{secondRoomId}}'),
    request('Restore Secondary Room', 'PATCH', '/rooms/{{secondRoomId}}/restore'),
  ]),

  folder('04 - Guests, Availability, and Reservations', [
    request('Create Guest', 'POST', '/guests', {
      body: {
        fullName: 'Amina Postman {{$timestamp}}',
        phone: '+252611234567',
        email: 'guest+{{$timestamp}}@example.com',
        passportNumber: 'PM{{$timestamp}}',
        nationality: 'Somali',
        address: 'Mogadishu',
        notes: 'Created by Postman',
        allowPossibleDuplicate: false,
      },
      save: { variable: 'guestId', path: 'id' },
    }),
    request(
      'List Guests',
      'GET',
      queryPath('/guests', { page: 1, pageSize: 25, search: 'Postman' }),
    ),
    request('Get Guest', 'GET', '/guests/{{guestId}}'),
    request('Update Guest', 'PATCH', '/guests/{{guestId}}', {
      body: { notes: 'Guest profile updated by Postman' },
    }),
    request(
      'Search Room Availability',
      'GET',
      queryPath('/availability/rooms', {
        checkInDate: '{{today}}',
        checkOutDate: '{{dayAfterTomorrow}}',
        roomTypeId: '{{roomTypeId}}',
        floorId: '{{floorId}}',
        adults: 1,
        children: 0,
      }),
    ),
    request('Create Main Reservation', 'POST', '/reservations', {
      body: {
        guestId: '{{guestId}}',
        checkInDate: '{{today}}',
        checkOutDate: '{{dayAfterTomorrow}}',
        adults: 1,
        children: 0,
        roomIds: ['{{roomId}}'],
        notes: 'Main end-to-end Postman stay',
      },
      save: { variable: 'reservationId', path: 'id' },
    }),
    request(
      'List Reservations with Filters',
      'GET',
      queryPath('/reservations', {
        page: 1,
        pageSize: 25,
        guestId: '{{guestId}}',
        roomId: '{{roomId}}',
        status: 'PENDING',
        arrivalFrom: '{{today}}',
        arrivalTo: '{{tomorrow}}',
      }),
    ),
    request('Get Reservation', 'GET', '/reservations/{{reservationId}}'),
    request('Update Reservation', 'PATCH', '/reservations/{{reservationId}}', {
      body: { adults: 2, notes: 'Reservation updated before confirmation' },
    }),
    request('Replace Reservation Room', 'PUT', '/reservations/{{reservationId}}/rooms', {
      body: { roomIds: ['{{secondRoomId}}'] },
    }),
    request('Restore Primary Reservation Room', 'PUT', '/reservations/{{reservationId}}/rooms', {
      body: { roomIds: ['{{roomId}}'] },
    }),
    request('Apply Reservation Discount', 'PATCH', '/reservations/{{reservationId}}/discount', {
      body: { amount: '10.00' },
    }),
    request('Confirm Main Reservation', 'POST', '/reservations/{{reservationId}}/confirm'),
    request('Create Reservation to Cancel', 'POST', '/reservations', {
      body: {
        guestId: '{{guestId}}',
        checkInDate: '{{today}}',
        checkOutDate: '{{dayAfterTomorrow}}',
        adults: 1,
        children: 0,
        roomIds: ['{{secondRoomId}}'],
        notes: 'Cancellation endpoint test',
      },
      save: { variable: 'cancelReservationId', path: 'id' },
    }),
    request(
      'Confirm Reservation to Cancel',
      'POST',
      '/reservations/{{cancelReservationId}}/confirm',
    ),
    request('Cancel Reservation', 'POST', '/reservations/{{cancelReservationId}}/cancel', {
      body: { note: 'Cancelled by complete Postman suite' },
    }),
    request('Create Reservation for No-show', 'POST', '/reservations', {
      body: {
        guestId: '{{guestId}}',
        checkInDate: '{{today}}',
        checkOutDate: '{{dayAfterTomorrow}}',
        adults: 1,
        children: 0,
        roomIds: ['{{secondRoomId}}'],
        notes: 'No-show endpoint test',
      },
      save: { variable: 'noShowReservationId', path: 'id' },
    }),
    request('Confirm No-show Reservation', 'POST', '/reservations/{{noShowReservationId}}/confirm'),
    request('Mark Reservation No-show', 'POST', '/reservations/{{noShowReservationId}}/no-show', {
      body: { note: 'Guest did not arrive' },
    }),
  ]),

  folder('05 - Stay, Services, Charges, and Folio', [
    request('Create Service', 'POST', '/services', {
      body: {
        name: 'Postman Airport Transfer {{$timestamp}}',
        description: 'Integration test service',
        defaultPrice: '25.00',
      },
      save: { variable: 'serviceId', path: 'id' },
    }),
    request('List Services', 'GET', '/services'),
    request('Get Service', 'GET', '/services/{{serviceId}}'),
    request('Update Service', 'PATCH', '/services/{{serviceId}}', {
      body: { defaultPrice: '30.00', description: 'Updated integration test service' },
    }),
    request('Deactivate Service', 'DELETE', '/services/{{serviceId}}'),
    request('Restore Service', 'PATCH', '/services/{{serviceId}}/restore'),
    request('Check In Reservation', 'POST', '/reservations/{{reservationId}}/check-in'),
    request(
      'Add Service Charge to Active Stay',
      'POST',
      '/reservations/{{reservationId}}/charges',
      {
        body: { serviceId: '{{serviceId}}', quantity: '1.00' },
        save: { variable: 'chargeId', path: 'id' },
      },
    ),
    request('List Reservation Charges', 'GET', '/reservations/{{reservationId}}/charges'),
    request('Get Reservation Folio', 'GET', '/reservations/{{reservationId}}/folio'),
    request('Void Service Charge', 'POST', '/charges/{{chargeId}}/void', {
      body: { reason: 'Testing retained charge void history' },
    }),
    request('Add Final Service Charge', 'POST', '/reservations/{{reservationId}}/charges', {
      body: { serviceId: '{{serviceId}}', quantity: '1.00' },
    }),
    request('Check Out Reservation', 'POST', '/reservations/{{reservationId}}/check-out'),
  ]),

  folder('06 - Payments, Invoices, and Expenses', [
    request('Create Payment Method', 'POST', '/payment-methods', {
      body: { name: 'Postman EVC {{$timestamp}}' },
      save: { variable: 'paymentMethodId', path: 'id' },
    }),
    request('List Payment Methods', 'GET', '/payment-methods'),
    request('Update Payment Method', 'PATCH', '/payment-methods/{{paymentMethodId}}', {
      body: { name: 'Postman EVC Updated {{$timestamp}}' },
    }),
    request('Deactivate Payment Method', 'DELETE', '/payment-methods/{{paymentMethodId}}'),
    request('Restore Payment Method', 'PATCH', '/payment-methods/{{paymentMethodId}}/restore'),
    request('Issue Invoice After Checkout', 'POST', '/reservations/{{reservationId}}/invoice', {
      save: { variable: 'invoiceId', path: 'invoice.id' },
    }),
    request('List Invoices', 'GET', '/invoices'),
    request('Get Invoice', 'GET', '/invoices/{{invoiceId}}'),
    request('Create Payment', 'POST', '/payments', {
      body: {
        reservationId: '{{reservationId}}',
        paymentMethodId: '{{paymentMethodId}}',
        requestKey: '{{$guid}}',
        amount: '25.00',
        reference: 'POSTMAN-PAY',
        note: 'Integration payment',
      },
      save: { variable: 'paymentId', path: 'payment.id' },
    }),
    request('Get Payment', 'GET', '/payments/{{paymentId}}'),
    request('List Reservation Payments', 'GET', '/reservations/{{reservationId}}/payments'),
    request('Refund Entire Test Payment', 'POST', '/payments/{{paymentId}}/refunds', {
      body: {
        requestKey: '{{$guid}}',
        amount: '25.00',
        reason: 'Full refund before invoice void',
        reference: 'POSTMAN-REFUND',
      },
    }),
    request('Void Invoice', 'POST', '/invoices/{{invoiceId}}/void', {
      body: { reason: 'Testing invoice void endpoint after full refund' },
    }),
    request('Create Expense Category', 'POST', '/expense-categories', {
      body: { name: 'Postman Operations {{$timestamp}}' },
      save: { variable: 'expenseCategoryId', path: 'id' },
    }),
    request('List Expense Categories', 'GET', '/expense-categories'),
    request('Update Expense Category', 'PATCH', '/expense-categories/{{expenseCategoryId}}', {
      body: { name: 'Postman Operations Updated {{$timestamp}}' },
    }),
    request('Deactivate Expense Category', 'DELETE', '/expense-categories/{{expenseCategoryId}}'),
    request(
      'Restore Expense Category',
      'PATCH',
      '/expense-categories/{{expenseCategoryId}}/restore',
    ),
    request('Create Expense', 'POST', '/expenses', {
      body: {
        categoryId: '{{expenseCategoryId}}',
        paymentMethodId: '{{paymentMethodId}}',
        requestKey: '{{$guid}}',
        amount: '30.00',
        expenseDate: '{{today}}',
        description: 'Generator fuel for Postman test',
        reference: 'POSTMAN-EXP',
      },
      save: { variable: 'expenseId', path: 'id' },
    }),
    request('List Expenses', 'GET', '/expenses'),
    request('Get Expense', 'GET', '/expenses/{{expenseId}}'),
    request('Reverse Expense', 'POST', '/expenses/{{expenseId}}/reverse', {
      body: { reason: 'Testing expense reversal history' },
    }),
  ]),

  folder('07 - Housekeeping and Maintenance', [
    request('List Housekeeping Tasks and Capture Stay Task', 'GET', '/housekeeping/tasks', {
      testScript: [
        "const tasks = pm.response.json(); const task = tasks.find((t) => t.reservationId === pm.collectionVariables.get('reservationId')); if (task) pm.collectionVariables.set('housekeepingTaskId', task.id);",
        "pm.test('Checkout housekeeping task found', () => pm.expect(pm.collectionVariables.get('housekeepingTaskId')).to.be.ok);",
      ],
    }),
    request('Get Housekeeping Task', 'GET', '/housekeeping/tasks/{{housekeepingTaskId}}'),
    request('Update Housekeeping Task', 'PATCH', '/housekeeping/tasks/{{housekeepingTaskId}}', {
      body: { assignedToId: '{{userId}}', notes: 'Assigned and updated by Postman' },
    }),
    request('Start Housekeeping Task', 'POST', '/housekeeping/tasks/{{housekeepingTaskId}}/start'),
    request(
      'Complete Housekeeping Task',
      'POST',
      '/housekeeping/tasks/{{housekeepingTaskId}}/complete',
    ),
    request('Create Maintenance Request', 'POST', '/maintenance/requests', {
      body: {
        roomId: '{{secondRoomId}}',
        problem: 'Air conditioner inspection required',
        assignedToId: '{{userId}}',
        notes: 'Created by Postman',
      },
      save: { variable: 'maintenanceId', path: 'id' },
    }),
    request('List Maintenance Requests', 'GET', '/maintenance/requests'),
    request('Get Maintenance Request', 'GET', '/maintenance/requests/{{maintenanceId}}'),
    request('Update Maintenance Request', 'PATCH', '/maintenance/requests/{{maintenanceId}}', {
      body: {
        problem: 'Air conditioner filter and thermostat inspection',
        notes: 'Scope updated by Postman',
      },
    }),
    request('Start Maintenance Request', 'POST', '/maintenance/requests/{{maintenanceId}}/start'),
    request(
      'Complete Maintenance Request',
      'POST',
      '/maintenance/requests/{{maintenanceId}}/complete',
      { body: { cost: '15.00', notes: 'Inspection complete' } },
    ),
  ]),

  folder('08 - Dashboard, Reports, and Audit Logs', [
    request('Dashboard Summary', 'GET', '/dashboard/summary'),
    request(
      'Revenue Report',
      'GET',
      queryPath('/reports/revenue', { from: '{{reportFrom}}', to: '{{reportTo}}' }),
    ),
    request(
      'Expense Report',
      'GET',
      queryPath('/reports/expenses', { from: '{{reportFrom}}', to: '{{reportTo}}' }),
    ),
    request(
      'Occupancy Report',
      'GET',
      queryPath('/reports/occupancy', { from: '{{reportFrom}}', to: '{{reportTo}}' }),
    ),
    request(
      'Reservations Report',
      'GET',
      queryPath('/reports/reservations', { from: '{{reportFrom}}', to: '{{reportTo}}' }),
    ),
    request(
      'Payments Report',
      'GET',
      queryPath('/reports/payments', { from: '{{reportFrom}}', to: '{{reportTo}}' }),
    ),
    request('Outstanding Balances Report', 'GET', '/reports/outstanding-balances'),
    request(
      'List Audit Logs',
      'GET',
      queryPath('/audit-logs', { entityType: 'Reservation', page: 1, limit: 50 }),
      {
        testScript: [
          "const value = pm.response.json(); const entries = value.data || value.items || []; if (entries[0]) pm.collectionVariables.set('auditId', entries[0].id);",
        ],
      },
    ),
    request('Get Audit Log', 'GET', '/audit-logs/{{auditId}}'),
  ]),
);

const environment = {
  id: 'b071e9ba-f1f5-45cc-a2da-46f7b49c3787',
  name: 'Somali Hotel ERP - Local',
  values: [
    { key: 'baseUrl', value: 'http://localhost:3001/api/v1', type: 'default', enabled: true },
    { key: 'adminIdentifier', value: 'admin@example.com', type: 'default', enabled: true },
    {
      key: 'adminPassword',
      value: 'replace_with_bootstrap_admin_password',
      type: 'secret',
      enabled: true,
    },
    {
      key: 'monitoringToken',
      value: 'replace_with_monitoring_token',
      type: 'secret',
      enabled: true,
    },
  ],
  _postman_variable_scope: 'environment',
  _postman_exported_at: new Date().toISOString(),
  _postman_exported_using: 'Codex',
};

await mkdir(here, { recursive: true });
await writeFile(join(here, 'Hotel-ERP.postman_collection.json'), `${json(collection)}\n`);
await writeFile(join(here, 'Hotel-ERP.local.postman_environment.json'), `${json(environment)}\n`);
console.log(
  `Generated ${collection.item.reduce((sum, group) => sum + group.item.length, 0)} requests.`,
);
