---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# NestJS에서 port 작성하기

> `common/dependency.md`의 `CA-DEP-03`, `common/boundaries.md`의 `CA-EXT-02`를 NestJS로 구현하는 방법이다.

## 1. port: 인터페이스와 주입 토큰 (usecase 계층)

```ts
// payments/payment-gateway.port.ts
export interface PaymentGateway {
  charge(amountWon: number, orderId: string): Promise<string>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
```

TypeScript 인터페이스는 실행 시점에 사라져 DI 토큰으로 쓸 수 없다. 그래서 `Symbol` 토큰을 함께 export한다.

## 2. adapter: 구현 (adapter 계층)

```ts
// payments/stripe-payment.adapter.ts
@Injectable()
export class StripePaymentAdapter implements PaymentGateway {
  constructor(private readonly client: Stripe) {}

  async charge(amountWon: number, orderId: string): Promise<string> {
    const intent = await this.client.paymentIntents.create({ amount: amountWon, currency: 'krw', metadata: { orderId } });
    return intent.id;
  }
}
```

## 3. 모듈에서 연결 (framework 계층)

```ts
@Module({
  providers: [{ provide: PAYMENT_GATEWAY, useClass: StripePaymentAdapter }],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
```

## 4. 유스케이스에서 사용

```ts
@Injectable()
export class OrdersService {
  constructor(@Inject(PAYMENT_GATEWAY) private readonly payments: PaymentGateway) {}
}
```

서비스는 `payment-gateway.port.ts`만 import한다. `stripe-payment.adapter.ts`를 import하면 `CA-EXT-02` 위반이다.

## 5. 테스트용 가짜

```ts
class FakePaymentGateway implements PaymentGateway {
  readonly charged: Array<{ amountWon: number; orderId: string }> = [];

  async charge(amountWon: number, orderId: string) {
    this.charged.push({ amountWon, orderId });
    return `fake-${orderId}`;
  }
}

const svc = new OrdersService(new FakePaymentGateway());
```

가짜는 port 인터페이스를 구현한 평범한 클래스다. `jest.fn()` 체인으로 SDK 모양을 흉내 내지 않는다.

## 규칙

- port 파일 이름은 `<기능>.port.ts`, 토큰 이름은 인터페이스 이름의 UPPER_SNAKE_CASE다.
- port 메서드는 바깥 SDK가 아니라 **유스케이스가 원하는 동작**으로 이름 짓는다(`charge`, `findByIdentity`).
- port의 입력·출력 타입은 port 파일에 정의한다. SDK 타입을 노출하지 않는다(`CA-EXT-03`).
