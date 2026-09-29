import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PAYMENT_GATEWAY } from './payment-gateway.port';
import { StripePaymentAdapter } from './stripe-payment.adapter';

@Module({
  imports: [OrdersModule],
  providers: [{ provide: PAYMENT_GATEWAY, useClass: StripePaymentAdapter }],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
