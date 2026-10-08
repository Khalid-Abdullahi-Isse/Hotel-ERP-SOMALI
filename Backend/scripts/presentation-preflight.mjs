import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { Pool } from 'pg';

const composeEnv = parse(readFileSync(fileURLToPath(new URL('../../.env', import.meta.url))));
for (const key of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']) {
  if (!composeEnv[key]) throw new Error(`Compose .env must define ${key}`);
}
const pool = new Pool({
  host: '127.0.0.1',
  port: Number(composeEnv.POSTGRES_HOST_PORT ?? 5433),
  user: composeEnv.POSTGRES_USER,
  password: composeEnv.POSTGRES_PASSWORD,
  database: composeEnv.POSTGRES_DB,
  connectionTimeoutMillis: 5000,
});
try {
  const catalog =
    await pool.query(`SELECT current_database() AS database, current_schema() AS schema,
    to_regclass('public."Hotel"')::text AS hotel_table,
    (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public') AS public_tables`);
  if (!catalog.rows[0].hotel_table) {
    console.log(
      JSON.stringify(
        {
          ...catalog.rows[0],
          message:
            'Compose database has no Hotel table; presentation seed cannot run without the application schema.',
        },
        null,
        2,
      ),
    );
    process.exitCode = 2;
  } else {
    const target =
      await pool.query(`SELECT current_database() AS database, inet_server_addr()::text AS server,
    (SELECT json_agg(json_build_object('code', h.code, 'name', h.name,
      'rooms', (SELECT count(*) FROM "Room" r WHERE r."hotelId"=h.id),
      'reservations', (SELECT count(*) FROM "Reservation" r WHERE r."hotelId"=h.id),
      'accountingEnabled', (SELECT EXISTS(SELECT 1 FROM "AccountingSettings" a WHERE a."hotelId"=h.id))) ORDER BY h.code)
      FROM "Hotel" h) AS hotels`);
    console.log(JSON.stringify(target.rows[0], null, 2));
  }
} finally {
  await pool.end();
}
