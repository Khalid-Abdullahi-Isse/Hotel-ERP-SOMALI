import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApplication } from './bootstrap/configure-application.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const { config, logger } = configureApplication(app);

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
  logger.log(`Hotel ERP API listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
