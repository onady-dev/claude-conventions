---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# NestJS 계층 대응

> `common/dependency.md`를 NestJS에 적용하는 방법이다.

## 파일 접미사와 계층 (arch.json이 없을 때 기본값)

위에서부터 처음 맞는 규칙을 적용한다.

| 계층 | 파일 |
| --- | --- |
| framework | `main.ts`, `*.module.ts` |
| entity | `*.entity.ts` |
| adapter | `*.controller.ts`, `*.guard.ts`, `*.strategy.ts`, `*.middleware.ts`, `*.filter.ts`, `*.interceptor.ts`, `*.adapter.ts`, `*.client.ts`, `*.repository.ts` |
| usecase | `*.service.ts`, `*.scheduler.ts`, `*.port.ts`, `*.dto.ts`, `dto/**` |
| domain | `*.policy.ts`, `*.domain.ts`, `domain/**` |

- 어디에도 맞지 않는 파일은 `unclassified`로 보고된다. 새 파일은 위 접미사 중 하나를 붙여 계층을 드러낸다.
- DTO는 유스케이스의 입력 모양이라 usecase 계층이다. `class-validator` 데코레이터가 붙어도 된다(usecase→framework 허용).
- 순수 로직 파일은 `*.policy.ts`(판정), `*.domain.ts`(계산·값 객체)로 이름 짓는다.

## 모듈 구성

- 모듈 하나는 업무 영역 하나다. URL 모양이 아니라 "무엇을 다루는가"로 나눈다.
- 모듈 `imports`에는 실제로 주입받는 모듈만 둔다. `exports`에는 다른 모듈이 쓰는 provider만 둔다.
- 관리자용과 앱용 컨트롤러를 나눌 때는 파일 이름과 경로 접두어를 함께 맞춘다(`admin-x.controller.ts` ↔ `@Controller('.../admin/x')`).
- 컨트롤러는 서비스만 주입받는다(`CA-CTRL-02`).

## 새 기능을 추가할 때 파일 순서

1. 판정·계산이 있으면 `*.policy.ts`에 순수 함수와 테스트를 먼저 만든다
2. 외부 시스템을 쓰면 `*.port.ts`에 인터페이스와 토큰을 만든다(`nestjs-ports.md`)
3. `*.service.ts`가 port와 순수 함수를 조합한다
4. `*.controller.ts`는 DTO 검증 후 서비스를 호출만 한다
