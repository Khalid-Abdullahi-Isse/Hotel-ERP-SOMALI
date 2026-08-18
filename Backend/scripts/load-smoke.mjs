import { performance } from 'node:perf_hooks';

const baseUrl = process.env.LOAD_BASE_URL ?? 'http://127.0.0.1:3001';
const identifier = process.env.LOAD_IDENTIFIER;
const password = process.env.LOAD_PASSWORD;
const requests = integer('LOAD_REQUESTS', 300, 1, 100_000);
const concurrency = integer('LOAD_CONCURRENCY', 10, 1, 200);
const paths = (process.env.LOAD_PATHS ??
  '/api/v1/auth/me,/api/v1/rooms?page=1&pageSize=25,/api/v1/dashboard/summary')
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean);

if (!identifier || !password) {
  throw new Error('LOAD_IDENTIFIER and LOAD_PASSWORD are required.');
}
if (paths.length === 0) throw new Error('LOAD_PATHS must contain at least one path.');

const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
  body: JSON.stringify({ identifier, password }),
});
if (!login.ok) throw new Error(`Load-test login failed with HTTP ${login.status}.`);
const authentication = await login.json();
if (typeof authentication.accessToken !== 'string') {
  throw new Error('Login response did not contain an access token.');
}

const results = [];
let cursor = 0;
const suiteStarted = performance.now();

await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (true) {
      const requestNumber = cursor++;
      if (requestNumber >= requests) return;
      const path = paths[requestNumber % paths.length];
      const started = performance.now();
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          headers: {
            authorization: `Bearer ${authentication.accessToken}`,
            'x-request-id': `load-${requestNumber.toString().padStart(8, '0')}`,
          },
        });
        await response.arrayBuffer();
        results.push({ path, status: response.status, durationMs: performance.now() - started });
      } catch {
        results.push({ path, status: 0, durationMs: performance.now() - started });
      }
    }
  }),
);

const durationSeconds = (performance.now() - suiteStarted) / 1000;
const successful = results.filter(({ status }) => status >= 200 && status < 400);
const statusCounts = Object.fromEntries(
  [...new Set(results.map(({ status }) => status))]
    .sort((a, b) => a - b)
    .map((status) => [status, results.filter((result) => result.status === status).length]),
);

const report = {
  baseUrl,
  requests,
  concurrency,
  durationSeconds: fixed(durationSeconds),
  requestsPerSecond: fixed(requests / durationSeconds),
  successRatePercent: fixed((successful.length / requests) * 100),
  statusCounts,
  latencyMs: distribution(results.map(({ durationMs }) => durationMs)),
  routes: Object.fromEntries(
    paths.map((path) => [
      path,
      distribution(results.filter((result) => result.path === path).map(({ durationMs }) => durationMs)),
    ]),
  ),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (successful.length !== requests) process.exitCode = 1;

function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: fixed(sorted.at(-1) ?? 0),
  };
}

function percentile(sorted, ratio) {
  if (sorted.length === 0) return 0;
  return fixed(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]);
}

function fixed(value) {
  return Number(value.toFixed(2));
}

function integer(name, fallback, minimum, maximum) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}
