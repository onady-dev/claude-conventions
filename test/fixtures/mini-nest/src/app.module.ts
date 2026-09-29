import { Module } from '@nestjs/common';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({ imports: [OrdersModule, PaymentsModule] })
export class AppModule {}
