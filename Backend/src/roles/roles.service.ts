import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { PERMISSIONS, SYSTEM_ROLES } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateRoleDto } from './dto/create-role.dto.js';
import type { SetRolePermissionsDto } from './dto/set-role-permissions.dto.js';
import type { UpdateRoleDto } from './dto/update-role.dto.js';

const ROLE_INCLUDE = {
  permissions: { include: { permission: true } },
  _count: { select: { users: true } },
} as const;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(actor: RequestUser) {
    const roles = await this.prisma.role.findMany({
      where: { hotelId: actor.hotelId },
      include: ROLE_INCLUDE,
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return roles.map((role) => this.view(role));
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  async create(dto: CreateRoleDto, actor: RequestUser) {
    this.assertNonReservedName(dto.name);
    const permissions = await this.resolvePermissions(dto.permissionKeys);
    const role = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.role.create({
        data: {
          hotelId: actor.hotelId,
          name: dto.name,
          description: dto.description,
          permissions: {
            create: permissions.map((permission) => ({ permissionId: permission.id })),
          },
        },
        include: ROLE_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'role.create',
          entityType: 'Role',
          entityId: created.id,
          newValue: this.auditView(created),
        },
        transaction,
      );
      return created;
    });
    return this.view(role);
  }

  async update(id: string, dto: UpdateRoleDto, actor: RequestUser) {
    const before = await this.findRole(id, actor.hotelId);
    if (before.isSystem && dto.name && dto.name !== before.name) {
      throw new ConflictException({
        code: 'SYSTEM_ROLE_PROTECTED',
        message: 'System roles cannot be renamed.',
      });
    }
    if (!before.isSystem && dto.name) this.assertNonReservedName(dto.name);

    const role = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.role.update({
        where: { id },
        data: dto,
        include: ROLE_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'role.update',
          entityType: 'Role',
          entityId: id,
          oldValue: this.auditView(before),
          newValue: this.auditView(updated),
        },
        transaction,
      );
      return updated;
    });
    return this.view(role);
  }

  async setPermissions(id: string, dto: SetRolePermissionsDto, actor: RequestUser) {
    const before = await this.findRole(id, actor.hotelId);
    const permissions = await this.resolvePermissions(dto.permissionKeys);
    if (before.name === SYSTEM_ROLES.ADMIN) {
      const keys = new Set(permissions.map((permission) => permission.key));
      if (!keys.has(PERMISSIONS.USER_MANAGE) || !keys.has(PERMISSIONS.ROLE_MANAGE)) {
        throw new ConflictException({
          code: 'ADMIN_PERMISSIONS_REQUIRED',
          message: 'The ADMIN role must retain user.manage and role.manage permissions.',
        });
      }
    }

    const role = await this.prisma.$transaction(async (transaction) => {
      await transaction.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissions.length) {
        await transaction.rolePermission.createMany({
          data: permissions.map((permission) => ({ roleId: id, permissionId: permission.id })),
        });
      }
      const updated = await transaction.role.findUniqueOrThrow({
        where: { id },
        include: ROLE_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'role.permissions_update',
          entityType: 'Role',
          entityId: id,
          oldValue: {
            permissions: before.permissions.map(({ permission }) => permission.key).sort(),
          },
          newValue: {
            permissions: updated.permissions.map(({ permission }) => permission.key).sort(),
          },
        },
        transaction,
      );
      return updated;
    });
    return this.view(role);
  }

  async deactivate(id: string, actor: RequestUser) {
    const before = await this.findRole(id, actor.hotelId);
    if (before.isSystem) {
      throw new ConflictException({
        code: 'SYSTEM_ROLE_PROTECTED',
        message: 'System roles cannot be deleted.',
      });
    }
    if (before._count.users > 0) {
      throw new ConflictException({
        code: 'ROLE_IN_USE',
        message: 'Move users to another role before deleting this role.',
      });
    }
    const role = await this.prisma.$transaction(async (transaction) => {
      const deactivated = await transaction.role.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
        include: ROLE_INCLUDE,
      });
      await this.auditLogs.record(
        {
          hotelId: actor.hotelId,
          userId: actor.id,
          action: 'role.deactivate',
          entityType: 'Role',
          entityId: id,
          oldValue: this.auditView(before),
          newValue: this.auditView(deactivated),
        },
        transaction,
      );
      return deactivated;
    });
    return this.view(role);
  }

  private async findRole(id: string, hotelId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, hotelId },
      include: ROLE_INCLUDE,
    });
    if (!role)
      throw new NotFoundException({ code: 'ROLE_NOT_FOUND', message: 'Role was not found.' });
    return role;
  }

  private async resolvePermissions(keys: string[]) {
    const uniqueKeys = [...new Set(keys)];
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: uniqueKeys } },
    });
    if (permissions.length !== uniqueKeys.length) {
      throw new ConflictException({
        code: 'INVALID_PERMISSION',
        message: 'One or more permission keys are invalid.',
      });
    }
    return permissions;
  }

  private assertNonReservedName(name: string): void {
    if (
      Object.values(SYSTEM_ROLES).includes(name as (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES])
    ) {
      throw new ConflictException({
        code: 'SYSTEM_ROLE_NAME_RESERVED',
        message: 'That role name is reserved.',
      });
    }
  }

  private view(role: {
    id: string;
    hotelId: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    isActive: boolean;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    permissions: Array<{ permission: { key: string; description: string | null } }>;
    _count: { users: number };
  }) {
    return {
      id: role.id,
      hotelId: role.hotelId,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      isActive: role.isActive,
      deletedAt: role.deletedAt,
      userCount: role._count.users,
      permissions: role.permissions
        .map(({ permission }) => permission)
        .sort((left, right) => left.key.localeCompare(right.key)),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  private auditView(role: Parameters<RolesService['view']>[0]): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(this.view(role))) as Prisma.InputJsonObject;
  }
}
