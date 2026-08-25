import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { SYSTEM_ROLES } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { paginatedResponse, paginationOffset } from '../common/pagination/pagination.util.js';
import { PasswordService } from '../auth/password.service.js';
import { UserStatus } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AssignRolesDto } from './dto/assign-roles.dto.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';

const USER_INCLUDE = {
  roles: {
    include: { role: { select: { id: true, name: true, isSystem: true, isActive: true } } },
  },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(dto: CreateUserDto, actor: RequestUser) {
    const roleIds = [...new Set(dto.roleIds)];
    await this.assertRoles(actor.hotelId, roleIds);
    const passwordHash = await this.passwords.hash(dto.password);

    const user = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: {
          hotelId: actor.hotelId,
          email: dto.email,
          username: dto.username,
          fullName: dto.fullName,
          passwordHash,
          roles: { create: roleIds.map((roleId) => ({ roleId })) },
        },
        include: USER_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'user.create',
          entityType: 'User',
          entityId: created.id,
          newValue: this.auditView(created),
        },
        transaction,
      );
      return created;
    });
    return this.view(user);
  }

  async list(query: ListUsersQueryDto, actor: RequestUser) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      hotelId: actor.hotelId,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { username: { contains: search, mode: 'insensitive' } },
              { roles: { some: { role: { name: { contains: search, mode: 'insensitive' } } } } },
            ],
          }
        : {}),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: USER_INCLUDE,
        orderBy: [{ deletedAt: 'asc' }, { fullName: 'asc' }, { id: 'asc' }],
        skip: paginationOffset(query.page, query.limit),
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginatedResponse(users.map((user) => this.view(user)), query.page, query.limit, total);
  }

  async findOne(id: string, actor: RequestUser) {
    return this.view(await this.findHotelUser(id, actor.hotelId));
  }

  async update(id: string, dto: UpdateUserDto, actor: RequestUser) {
    const before = await this.findHotelUser(id, actor.hotelId);
    const updated = await this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({
        where: { id },
        data: dto,
        include: USER_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'user.update',
          entityType: 'User',
          entityId: id,
          oldValue: this.auditView(before),
          newValue: this.auditView(user),
        },
        transaction,
      );
      return user;
    });
    return this.view(updated);
  }

  async deactivate(id: string, actor: RequestUser) {
    const user = await this.prisma.$transaction(async (transaction) => {
      await this.lockHotelAdministration(transaction, actor.hotelId);
      const before = await this.findHotelUser(id, actor.hotelId, transaction);
      if (this.hasAdminRole(before))
        await this.assertAnotherActiveAdmin(transaction, actor.hotelId, id);
      const deactivated = await transaction.user.update({
        where: { id },
        data: { status: UserStatus.INACTIVE, deletedAt: new Date(), lockedUntil: null },
        include: USER_INCLUDE,
      });
      await transaction.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'user deactivated by administrator' },
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'user.deactivate',
          entityType: 'User',
          entityId: id,
          oldValue: this.auditView(before),
          newValue: this.auditView(deactivated),
        },
        transaction,
      );
      return deactivated;
    });
    return this.view(user);
  }

  async restore(id: string, actor: RequestUser) {
    const before = await this.findHotelUser(id, actor.hotelId);
    const user = await this.prisma.$transaction(async (transaction) => {
      const restored = await transaction.user.update({
        where: { id },
        data: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        include: USER_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'user.restore',
          entityType: 'User',
          entityId: id,
          oldValue: this.auditView(before),
          newValue: this.auditView(restored),
        },
        transaction,
      );
      return restored;
    });
    return this.view(user);
  }

  async unlock(id: string, actor: RequestUser) {
    const before = await this.findHotelUser(id, actor.hotelId);
    if (before.deletedAt)
      throw new ConflictException({
        code: 'USER_DEACTIVATED',
        message: 'Restore the user before unlocking the account.',
      });
    const user = await this.prisma.$transaction(async (transaction) => {
      const unlocked = await transaction.user.update({
        where: { id },
        data: { status: UserStatus.ACTIVE, failedLoginAttempts: 0, lockedUntil: null },
        include: USER_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'user.unlock',
          entityType: 'User',
          entityId: id,
          oldValue: this.auditView(before),
          newValue: this.auditView(unlocked),
        },
        transaction,
      );
      return unlocked;
    });
    return this.view(user);
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    actor: RequestUser,
  ): Promise<{ message: string }> {
    const target = await this.findHotelUser(id, actor.hotelId);
    const passwordHash = await this.passwords.hash(dto.password);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id },
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
          status: target.status === UserStatus.LOCKED ? UserStatus.ACTIVE : target.status,
        },
      });
      await transaction.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: 'password reset by administrator' },
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'user.password_reset',
          entityType: 'User',
          entityId: id,
        },
        transaction,
      );
    });
    return { message: 'Password reset successfully. All sessions were revoked.' };
  }

  async assignRoles(id: string, dto: AssignRolesDto, actor: RequestUser) {
    const roleIds = [...new Set(dto.roleIds)];
    const roles = await this.assertRoles(actor.hotelId, roleIds);
    const user = await this.prisma.$transaction(async (transaction) => {
      await this.lockHotelAdministration(transaction, actor.hotelId);
      const before = await this.findHotelUser(id, actor.hotelId, transaction);
      const keepsAdmin = roles.some((role) => role.name === SYSTEM_ROLES.ADMIN);
      if (this.hasAdminRole(before) && !keepsAdmin) {
        await this.assertAnotherActiveAdmin(transaction, actor.hotelId, id);
      }
      await transaction.userRole.deleteMany({ where: { userId: id } });
      await transaction.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId })),
      });
      const updated = await transaction.user.findUniqueOrThrow({
        where: { id },
        include: USER_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'user.roles_update',
          entityType: 'User',
          entityId: id,
          oldValue: { roles: before.roles.map(({ role }) => role.name) },
          newValue: { roles: updated.roles.map(({ role }) => role.name) },
        },
        transaction,
      );
      return updated;
    });
    return this.view(user);
  }

  private async assertRoles(hotelId: string, roleIds: string[]) {
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, hotelId, isActive: true, deletedAt: null },
      select: { id: true, name: true },
    });
    if (roles.length !== roleIds.length) {
      throw new ConflictException({
        code: 'INVALID_ROLE_ASSIGNMENT',
        message: 'One or more roles are invalid, inactive, or belong to another hotel.',
      });
    }
    return roles;
  }

  private async findHotelUser(id: string, hotelId: string, transaction?: Prisma.TransactionClient) {
    const database = transaction ?? this.prisma;
    const user = await database.user.findFirst({ where: { id, hotelId }, include: USER_INCLUDE });
    if (!user)
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User was not found.' });
    return user;
  }

  private hasAdminRole(user: { roles: Array<{ role: { name: string } }> }): boolean {
    return user.roles.some(({ role }) => role.name === SYSTEM_ROLES.ADMIN);
  }

  private async assertAnotherActiveAdmin(
    transaction: Prisma.TransactionClient,
    hotelId: string,
    excludedUserId: string,
  ): Promise<void> {
    const count = await transaction.user.count({
      where: {
        hotelId,
        id: { not: excludedUserId },
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roles: { some: { role: { name: SYSTEM_ROLES.ADMIN, isSystem: true, isActive: true } } },
      },
    });
    if (count === 0) {
      throw new ConflictException({
        code: 'LAST_ADMIN_REQUIRED',
        message: 'The hotel must retain at least one active administrator.',
      });
    }
  }

  private async lockHotelAdministration(
    transaction: Prisma.TransactionClient,
    hotelId: string,
  ): Promise<void> {
    await transaction.$queryRaw`
      SELECT 1::int AS locked
      FROM (SELECT pg_advisory_xact_lock(hashtext(${hotelId}))) AS hotel_admin_lock
    `;
  }

  private view(user: {
    id: string;
    hotelId: string;
    email: string;
    username: string;
    fullName: string;
    status: UserStatus;
    failedLoginAttempts: number;
    lockedUntil: Date | null;
    lastLoginAt: Date | null;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    roles: Array<{ role: { id: string; name: string; isSystem: boolean; isActive: boolean } }>;
  }) {
    return {
      id: user.id,
      hotelId: user.hotelId,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      status: user.status,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      lastLoginAt: user.lastLoginAt,
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.roles.map(({ role }) => role),
    };
  }

  private auditView(user: Parameters<UsersService['view']>[0]): Prisma.InputJsonObject {
    const view = this.view(user);
    return JSON.parse(JSON.stringify(view)) as Prisma.InputJsonObject;
  }
}
