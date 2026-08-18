import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { z } from 'zod';
import { ALL_PERMISSIONS, ROLE_PERMISSION_MATRIX, SYSTEM_ROLES } from '../auth/auth.constants.js';
import { PrismaClient } from '../generated/prisma/client.js';

const inputSchema = z.object({
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  BOOTSTRAP_HOTEL_CODE: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .transform((value) => value.toUpperCase()),
  BOOTSTRAP_HOTEL_NAME: z.string().trim().min(2).max(160),
  BOOTSTRAP_ADMIN_EMAIL: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  BOOTSTRAP_ADMIN_USERNAME: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)
    .transform((value) => value.toLowerCase()),
  BOOTSTRAP_ADMIN_FULL_NAME: z.string().trim().min(2).max(160),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(128),
});

async function main(): Promise<void> {
  const parsed = inputSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid bootstrap configuration: ${message}`);
  }

  const input = parsed.data;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: input.DATABASE_URL }),
  });
  try {
    const passwordHash = await argon2.hash(input.BOOTSTRAP_ADMIN_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
      hashLength: 32,
    });

    const result = await prisma.$transaction(async (transaction) => {
      const hotel = await transaction.hotel.upsert({
        where: { code: input.BOOTSTRAP_HOTEL_CODE },
        update: {},
        create: { code: input.BOOTSTRAP_HOTEL_CODE, name: input.BOOTSTRAP_HOTEL_NAME },
      });

      for (const key of ALL_PERMISSIONS) {
        await transaction.permission.upsert({
          where: { key },
          update: {},
          create: { key, description: permissionDescription(key) },
        });
      }
      const permissionRecords = await transaction.permission.findMany({
        where: { key: { in: ALL_PERMISSIONS } },
      });
      const permissionByKey = new Map(
        permissionRecords.map((permission) => [permission.key, permission.id]),
      );

      const roles = new Map<string, string>();
      for (const roleName of Object.values(SYSTEM_ROLES)) {
        const existing = await transaction.role.findUnique({
          where: { hotelId_name: { hotelId: hotel.id, name: roleName } },
        });
        if (existing && !existing.isSystem) {
          throw new Error(`Reserved role ${roleName} already exists as a custom role.`);
        }
        const role =
          existing ??
          (await transaction.role.create({
            data: {
              hotelId: hotel.id,
              name: roleName,
              isSystem: true,
              description: systemRoleDescription(roleName),
            },
          }));
        roles.set(roleName, role.id);
        await transaction.rolePermission.deleteMany({ where: { roleId: role.id } });
        await transaction.rolePermission.createMany({
          data: ROLE_PERMISSION_MATRIX[roleName].map((key) => ({
            roleId: role.id,
            permissionId: requiredMapValue(permissionByKey, key),
          })),
        });
      }

      const existingUser = await transaction.user.findFirst({
        where: {
          OR: [
            { email: input.BOOTSTRAP_ADMIN_EMAIL },
            { username: input.BOOTSTRAP_ADMIN_USERNAME },
          ],
        },
      });
      if (existingUser && existingUser.hotelId !== hotel.id) {
        throw new Error('The bootstrap email or username is already used by another hotel.');
      }
      const admin =
        existingUser ??
        (await transaction.user.create({
          data: {
            hotelId: hotel.id,
            email: input.BOOTSTRAP_ADMIN_EMAIL,
            username: input.BOOTSTRAP_ADMIN_USERNAME,
            fullName: input.BOOTSTRAP_ADMIN_FULL_NAME,
            passwordHash,
          },
        }));

      await transaction.userRole.upsert({
        where: {
          userId_roleId: {
            userId: admin.id,
            roleId: requiredMapValue(roles, SYSTEM_ROLES.ADMIN),
          },
        },
        update: {},
        create: { userId: admin.id, roleId: requiredMapValue(roles, SYSTEM_ROLES.ADMIN) },
      });
      await transaction.auditLog.create({
        data: {
          hotelId: hotel.id,
          userId: admin.id,
          action: existingUser ? 'bootstrap.verified' : 'bootstrap.admin_created',
          entityType: 'User',
          entityId: admin.id,
          newValue: {
            email: admin.email,
            username: admin.username,
            role: SYSTEM_ROLES.ADMIN,
          },
        },
      });
      return { hotelId: hotel.id, adminId: admin.id, created: !existingUser };
    });

    process.stdout.write(
      `Bootstrap complete. Hotel ID: ${result.hotelId}; Admin ID: ${result.adminId}; Created: ${result.created}\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

function requiredMapValue(map: Map<string, string>, key: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`Bootstrap mapping is missing ${key}.`);
  return value;
}

function permissionDescription(key: string): string {
  return `Allows ${key.replace('.', ' ').replaceAll('_', ' ')} operations.`;
}

function systemRoleDescription(role: string): string {
  if (role === SYSTEM_ROLES.ADMIN) return 'Hotel administrator with user and role management.';
  if (role === SYSTEM_ROLES.MANAGER) return 'Hotel manager with operational and reporting access.';
  return 'Combined reception, cashier, check-in/out, and housekeeping staff access.';
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown bootstrap failure';
  process.stderr.write(`Bootstrap failed: ${message}\n`);
  process.exitCode = 1;
});
