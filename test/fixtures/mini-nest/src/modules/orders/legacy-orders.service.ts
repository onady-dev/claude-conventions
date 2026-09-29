import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { StripePaymentAdapter } from '../payments/stripe-payment.adapter';

@Injectable()
export class LegacyOrdersService {
  private readonly adapter = new StripePaymentAdapter(new Stripe('test-key'));

  refund(chargeId: string): Promise<string> {
    return this.adapter.charge(-1);
  }
}
