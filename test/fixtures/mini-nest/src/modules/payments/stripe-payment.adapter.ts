import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import type { PaymentGateway } from './payment-gateway.port';

@Injectable()
export class StripePaymentAdapter implements PaymentGateway {
  constructor(private readonly client: Stripe) {}

  async charge(amount: number): Promise<string> {
    const intent = await this.client.paymentIntents.create({ amount, currency: 'krw' });
    return intent.id;
  }
}
