import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter.js';
import { safeRequestId } from '../common/http/request-id.js';

export function configureApplication(app: NestExpressApplication): {
  config: ConfigService;
  logger: Logger;
} {
  const config = app.get(ConfigService);
  const logger = app.get(Logger);
  app.useLogger(logger);

  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestId = safeRequestId(request.headers['x-request-id']);
    request.id = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  });

  const express = app.getHttpAdapter().getInstance();
  express.set('trust proxy', config.getOrThrow<number>('TRUST_PROXY_HOPS'));
  app.use(helmet());
  app.use(cookieParser());
  const bodyLimit = config.getOrThrow<number>('BODY_LIMIT_BYTES');
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: false, limit: bodyLimit }));
  app.enableShutdownHooks();
  app.setGlobalPrefix(config.getOrThrow<string>('API_PREFIX'));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableCors({
    origin: config.getOrThrow<string[]>('CORS_ORIGINS'),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    maxAge: 86_400,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  if (config.getOrThrow<boolean>('SWAGGER_ENABLED')) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Somali Hotel ERP API')
      .setDescription('REST API for focused hotel operations and financial management')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: false },
    });
  }
  return { config, logger };
}
