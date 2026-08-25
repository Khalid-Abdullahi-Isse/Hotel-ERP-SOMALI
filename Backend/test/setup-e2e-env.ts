import 'dotenv/config';

const developmentDatabaseUrl = process.env.DATABASE_URL;
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required for end-to-end tests. Refusing to use DATABASE_URL because the tests reset their database.',
  );
}

let databaseName: string;
try {
  databaseName = new URL(testDatabaseUrl).pathname.replace(/^\//, '');
} catch {
  throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
}

if (!/(^|[_-])test($|[_-])/i.test(databaseName)) {
  throw new Error(
    `TEST_DATABASE_URL must target a clearly named test database; received database "${databaseName}".`,
  );
}

if (testDatabaseUrl === developmentDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL must be different from DATABASE_URL.');
}

process.env.DATABASE_URL = testDatabaseUrl;
