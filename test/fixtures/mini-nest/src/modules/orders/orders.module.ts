import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { PaymentsModule } from '../payments/payments.module';
import { BadOrdersController } from './bad-orders.controller';
import { LegacyOrdersService } from './legacy-orders.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    // 주문 테이블
    TypeOrmModule.forFeature([Order]),
    PaymentsModule,
  ],
  controllers: [OrdersController, BadOrdersController],
  providers: [OrdersService, LegacyOrdersService],
})
export class OrdersModule {}
