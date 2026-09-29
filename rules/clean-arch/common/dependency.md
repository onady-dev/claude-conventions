---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.mjs"
  - "**/*.py"
  - "**/*.java"
  - "**/*.kt"
  - "**/*.go"
  - "**/*.cs"
---

# 의존 방향

## 계층

| 계층 | 담는 것 | 예 |
| --- | --- | --- |
| domain | 업무 규칙·계산·판정. 입력을 받아 결과를 돌려준다 | 배송 가능 지역 판정, 요금 계산 |
| usecase | 업무 흐름 하나의 순서를 조정한다. port 호출, 트랜잭션 경계 | "주문을 승인한다" |
| adapter | 바깥 세계와 연결한다 | HTTP 컨트롤러, 외부 API 클라이언트, 가드 |
| entity | ORM 엔티티(테이블 정의) | `@Entity` 클래스 |
| framework | 조립과 부팅 | 모듈 정의, `main` |

## 허용표

행이 import하는 쪽, 열이 import당하는 쪽이다.

```
             domain   usecase   adapter    entity      framework
domain         O         X         X       type만 O        X
usecase        O         O      X(EXT-02)     O            O
adapter        O         O         O          O            O
framework      O         O         O          O            O
```

외부 패키지 import 규칙은 `pure-logic.md`(도메인)와 `boundaries.md`(외부 SDK)에 있다.

### CA-DEP-01 도메인은 바깥 계층을 import하지 않는다

- 규칙: domain 파일은 domain 파일과 entity(`import type`만)만 import한다.
- 이유: 도메인이 유스케이스나 어댑터를 알면, 바깥을 바꿀 때 규칙이 같이 깨지고 테스트에 바깥이 딸려 온다.
- 나쁜 예: `order-expiry.policy.ts`가 `import { OrdersService } from './orders.service'`
- 좋은 예: 필요한 값을 서비스가 조회해 인자로 넘긴다. `isExpired(order, createdAtMs, nowMs)`
- 판정: 스크립트
- 분류되지 않은(`unclassified`) 파일로 가는 import는 검사하지 않는다. 새 파일은 계층을 드러내는 접미사를 붙이거나 `arch.json` layers에 추가한다.

### CA-DEP-02 모듈 사이에 순환 의존을 만들지 않는다

- 규칙: 기능 모듈 A가 B를 import하면 B는 A를 import하지 않는다(`import type` 제외).
- 이유: 순환이 있으면 어느 쪽도 따로 이해·테스트·교체할 수 없다. NestJS의 `forwardRef`가 필요해졌다면 순환의 신호다.
- 좋은 예: 공통 부분을 세 번째 모듈로 빼거나, 한쪽이 port를 정의하고 다른 쪽이 구현한다.
- 판정: 스크립트. baseline에는 `file`을 `cycle:<모듈>,<모듈>`(이름순) 형식으로 적는다.

### CA-DEP-03 안쪽이 바깥 기능이 필요하면 안쪽이 인터페이스를 정의한다

- 규칙: 유스케이스가 DB 저장·외부 호출 같은 바깥 기능을 쓸 때, 필요한 기능을 port(인터페이스)로 정의하고 바깥이 구현한다. 이것을 의존성 역전이라고 한다.
- 이유: import 화살표가 바깥→안쪽으로 뒤집혀, 구현을 바꿔도 유스케이스가 바뀌지 않고 테스트는 가짜 구현 하나로 끝난다.

```
유스케이스 ──호출──▶ «port» PaymentGateway          (유스케이스 계층이 소유)
                         ▲ implements
          adapter: StripePaymentAdapter / 테스트: FakePaymentGateway
```

- 판정: AI. 외부 시스템에는 필수(`CA-EXT-02`), DB 조회에는 선택(`CA-OPT-03`)이다.
