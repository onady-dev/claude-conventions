---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeORM 사용 규칙

> 선택 원칙(`common/optional.md`)을 적용하지 않은 기본 상태의 규칙이다.

## 엔티티

- 엔티티는 한 곳(예: `src/entities/`)에 모으거나 `*.entity.ts`로 이름 짓는다. 어느 쪽이든 entity 계층으로 분류되게 한다.
- 엔티티에는 컬럼 정의와 관계만 둔다. 업무 판정 메서드는 domain 파일의 함수로 둔다(`CA-PURE-04`).

## 유스케이스에서의 접근

- 서비스는 `@InjectRepository(Entity)`로 `Repository<Entity>`를 주입받아 쓴다. `CA-OPT-03` 기준을 충족한 테이블만 repository port를 거친다.
- 컨트롤러는 repository를 주입받지 않는다(`CA-CTRL-02`).
- 여러 모듈에 같은 조회 조건이 반복되면 `CA-OPT-03` 도입을 검토한다.

## 트랜잭션

- 트랜잭션은 유스케이스가 시작한다: `this.dataSource.transaction(async (manager) => { ... })`
- 트랜잭션 안에서 호출하는 보조 함수는 `manager`를 **필수 인자**로 받아 `manager.getRepository(Entity)`를 쓴다.
- 나쁜 예: `const repo = manager?.getRepository(X) ?? this.repo` — 호출하는 쪽이 manager를 빠뜨려도 조용히 트랜잭션 밖에서 실행된다.
- 좋은 예: 트랜잭션용 함수와 일반 함수를 나누고, 트랜잭션용은 `manager: EntityManager`를 필수로 받는다.

## 도메인에서의 참조

```ts
// order-pricing.policy.ts
import type { Order } from '../../entities/order.entity';

export function totalWithTax(order: Pick<Order, 'amount'>, rate: number): number {
  return Math.round(order.amount * (1 + rate));
}
```

- `import type`만 쓴다(`CA-PURE-02`).
- 필요한 필드만 `Pick<Entity, ...>`으로 받으면 테스트에서 엔티티 전체를 만들 필요가 없다.
