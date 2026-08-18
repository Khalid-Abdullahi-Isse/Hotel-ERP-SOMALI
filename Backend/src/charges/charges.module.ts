import { Module } from '@nestjs/common';
import { ChargesController } from './charges.controller.js';
import { ChargesService } from './charges.service.js';

@Module({
  controllers: [ChargesController],
  providers: [ChargesService],
  exports: [ChargesService],
})
export class ChargesModule {}
