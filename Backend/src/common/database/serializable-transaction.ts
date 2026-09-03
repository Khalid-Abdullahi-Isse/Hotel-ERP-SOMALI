import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

export async function runSerializable<T>(
  prisma: PrismaService,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let finalError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (error) {
      finalError = error;
      finalError = error;
      if (!hasErrorMarker(error, ['P2034', '40001', '40P01']) || attempt === 2) throw error;
    }
  }
  throw finalError;
}

function hasErrorMarker(error: unknown, markers: string[]): boolean {
  const visited = new WeakSet<object>();
  const inspect = (value: unknown, depth: number): boolean => {
    if (depth > 5) return false;
    if (typeof value === 'string') return markers.some((marker) => value.includes(marker));
    if (typeof value !== 'object' || value === null || visited.has(value)) return false;
    visited.add(value);
    return Object.values(value).some((entry) => inspect(entry, depth + 1));
  };
  return inspect(error, 0);
}
