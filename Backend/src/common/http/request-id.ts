import { randomUUID } from 'node:crypto';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export function safeRequestId(value: unknown): string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value) ? value : randomUUID();
}
