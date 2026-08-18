import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { MaintenanceModule } from './maintenance/maintenance.module.js';
import { RequestTimeoutInterceptor } from './common/interceptors/request-timeout.interceptor.js';
import { AuditLogsModule } from './audit-logs/audit-logs.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ChargesModule } from './charges/charges.module.js';
import { configuration, validateEnvironment } from './config/configuration.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { HealthModule } from './health/health.module.js';
import { MetricsInterceptor } from './health/metrics.interceptor.js';
import { HousekeepingModule } from './housekeeping/housekeeping.module.js';
import { HotelsModule } from './hotels/hotels.module.js';
import { InvoicesModule } from './invoices/invoices.module.js';
import { GuestsModule } from './guests/guests.module.js';
import { FloorsModule } from './floors/floors.module.js';
import { ExpensesModule } from './expenses/expenses.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { RolesModule } from './roles/roles.module.js';
import { ReservationsModule } from './reservations/reservations.module.js';
import { ReportsModule } from './reports/reports.module.js';
import { RoomTypesModule } from './room-types/room-types.module.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { ServicesModule } from './services/services.module.js';
import { StaysModule } from './stays/stays.module.js';
import { UsersModule } from './users/users.module.js';
import { safeRequestId } from './common/http/request-id.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: config.getOrThrow<number>('RATE_LIMIT_PER_MINUTE'),
          },
        ],
      }),
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.getOrThrow<string>('LOG_LEVEL'),
          genReqId: (request, response) => {
            const requestId = safeRequestId(request.id ?? request.headers['x-request-id']);
            response.setHeader('X-Request-Id', requestId);
            return requestId;
          },
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.accessToken',
              'req.body.refreshToken',
            ],
            censor: '[REDACTED]',
          },
          serializers: {
            req: (req: { id?: string; method?: string; url?: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
          },
        },
      }),
    }),
    PrismaModule,
    AuditLogsModule,
    AuthModule,
    ChargesModule,
    PaymentMethodsModule,
    PaymentsModule,
    UsersModule,
    RolesModule,
    ExpensesModule,
    HotelsModule,
    InvoicesModule,
    FloorsModule,
    RoomTypesModule,
    RoomsModule,
    GuestsModule,
    AvailabilityModule,
    ReservationsModule,
    ServicesModule,
    StaysModule,
    HealthModule,
    HousekeepingModule,
    MaintenanceModule,
    DashboardModule,
    ReportsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: RequestTimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
})
export class AppModule {}
