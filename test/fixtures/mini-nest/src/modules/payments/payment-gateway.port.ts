export interface PaymentGateway {
  charge(amount: number): Promise<string>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
