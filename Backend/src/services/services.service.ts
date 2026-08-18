import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { PERMISSIONS } from '../auth/auth.constants.js';
import type { RequestUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateServiceDto } from './dto/create-service.dto.js';
import type { UpdateServiceDto } from './dto/update-service.dto.js';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(dto: CreateServiceDto, actor: RequestUser) {
    return this.prisma.$transaction(async (transaction) => {
      const service = await transaction.service.create({
        data: { ...dto, hotelId: actor.hotelId },
      });
      await this.audit(transaction, actor, 'service.create', service.id, undefined, service);
      return this.view(service);
    });
  }

  async list(actor: RequestUser) {
    const canManage = actor.permissions.includes(PERMISSIONS.SERVICE_MANAGE);
    const services = await this.prisma.service.findMany({
      where: { hotelId: actor.hotelId, ...(canManage ? {} : { isActive: true }) },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return services.map((service) => this.view(service));
  }

  async findOne(id: string, actor: RequestUser) {
    const canManage = actor.permissions.includes(PERMISSIONS.SERVICE_MANAGE);
    return this.view(await this.findHotelService(id, actor.hotelId, canManage));
  }

  async update(id: string, dto: UpdateServiceDto, actor: RequestUser) {
    return this.prisma.$transaction(async (transaction) => {
      const before = await transaction.service.findFirst({ where: { id, hotelId: actor.hotelId } });
      if (!before) this.notFound();
      const service = await transaction.service.update({ where: { id }, data: dto });
      const action =
        dto.defaultPrice !== undefined &&
        before.defaultPrice.toString() !== service.defaultPrice.toString()
          ? 'service.price_update'
          : 'service.update';
      await this.audit(transaction, actor, action, id, before, service);
      return this.view(service);
    });
  }

  async setActive(id: string, isActive: boolean, actor: RequestUser) {
    return this.prisma.$transaction(async (transaction) => {
      const before = await transaction.service.findFirst({ where: { id, hotelId: actor.hotelId } });
      if (!before) this.notFound();
      const service = await transaction.service.update({ where: { id }, data: { isActive } });
      await this.audit(
        transaction,
        actor,
        isActive ? 'service.restore' : 'service.deactivate',
        id,
        before,
        service,
      );
      return this.view(service);
    });
  }

  private async findHotelService(id: string, hotelId: string, includeInactive: boolean) {
    const service = await this.prisma.service.findFirst({
      where: { id, hotelId, ...(includeInactive ? {} : { isActive: true }) },
    });
    if (!service) this.notFound();
    return service;
  }

  private async audit(
    transaction: Prisma.TransactionClient,
    actor: RequestUser,
    action: string,
    entityId: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    await this.auditLogs.record(
      {
        hotelId: actor.hotelId,
        userId: actor.id,
        action,
        entityType: 'Service',
        entityId,
        ...(oldValue === undefined ? {} : { oldValue: this.json(this.view(oldValue)) }),
        ...(newValue === undefined ? {} : { newValue: this.json(this.view(newValue)) }),
      },
      transaction,
    );
  }

  private view<T>(service: T): T | (T & { defaultPrice: string }) {
    if (typeof service !== 'object' || service === null || !('defaultPrice' in service))
      return service;
    const value = service as T & { defaultPrice: { toString(): string } };
    return { ...value, defaultPrice: value.defaultPrice.toString() };
  }

  private json(value: unknown): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }

  private notFound(): never {
    throw new NotFoundException({ code: 'SERVICE_NOT_FOUND', message: 'Service was not found.' });
  }
}
