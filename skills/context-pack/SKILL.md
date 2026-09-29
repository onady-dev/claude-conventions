---
name: context-pack
description: TypeScript/NestJS 프로젝트에서 모듈이나 파일을 수정·추가하기 전, 또는 코드 구조 질문에 답하기 전에 먼저 실행한다. 라우트·가드, 의존 모듈, 엔티티 컬럼, 서비스 public 메서드(줄 번호), DTO 필드, 도메인 함수, 사용처를 한 줄 JSON으로 받아 Grep/Read 탐색을 대신한다.
---

# context-pack

스크립트가 모듈을 먼저 읽고, 코드 작업에 필요한 메타데이터만 JSON으로 요약한다.
import 문·로깅·에러 처리 같은 세부를 읽지 않으므로 컨텍스트를 아낀다.

## 언제 쓰나

- 기존 모듈에 기능을 추가하거나 수정하기 전
- "이 모듈은 어떤 API가 있나", "이 테이블은 누가 쓰나" 같은 구조 질문
- 여러 파일을 Grep·Read로 돌아다니려고 할 때 — 그 전에 이 스킬을 먼저 쓴다

## 실행

```bash
node "<이 스킬 폴더>/scripts/context-pack.mjs" <대상> --root <프로젝트 루트>
```

- `<대상>`: 모듈 이름(`modulesDir` 바로 아래 폴더 이름, 기본 `src/modules/<이름>`) 또는 파일 경로(`src/modules/orders/order-pricing.policy.ts`)
- `--config <경로>`: `.claude/arch.json`이 아닌 설정 파일을 쓸 때
- `--out <파일>`: 결과를 파일로 저장하고 크기만 출력한다

## 결과 읽는 법

| 필드 | 뜻 |
| --- | --- |
| `files` | 대상 파일과 계층(`domain`/`usecase`/`adapter`/`entity`/`framework`/`unclassified`), 줄 수 |
| `imports` / `packageImports` | `@Module.imports`에 적힌 내부 모듈 / 패키지 |
| `entities` | 이 모듈이 쓰는 엔티티와 컬럼 이름. `null`이면 엔티티 파일을 해석하지 못한 것 |
| `controllers`, `routes` | 컨트롤러 기본 경로, 라우트별 메서드·전체 경로·가드·기타 데코레이터·줄 번호 |
| `services` | `@Injectable` 클래스의 public 메서드. `이름(파라미터) :줄번호` |
| `pureExports` | 도메인 파일의 export 함수·상수 |
| `dtos` | DTO 클래스와 필드 |
| `specs` | 관련 테스트 파일 |
| `usedBy` | 이 모듈을 import하는 다른 모듈 |
| `unparsed` | 스크립트가 해석하지 못한 줄. 이 부분만 원본을 확인한다 |
| `truncated` | `true`면 크기 상한 때문에 메서드가 이름만 남았다 |
| `overLimit` | `true`면 줄인 뒤에도 상한을 넘는다. `--out`으로 파일에 저장하고 필요한 필드만 읽는다 |

## 절차

1. 대상 모듈에 대해 먼저 실행한다.
2. JSON이 답하는 내용(라우트, 의존, 컬럼, 메서드 목록)은 파일을 다시 열어 확인하지 않는다.
3. 구현 세부가 필요한 파일만 `:줄번호`를 이용해 필요한 범위만 Read한다.
4. `unparsed`나 `truncated`가 있으면 그 부분만 원본을 확인한다.

## 오류

- 종료 코드 2와 `candidates`: 대상 이름이 틀렸다. 후보 중 맞는 이름으로 다시 실행한다. 폴더를 직접 탐색하지 않는다.
- 종료 코드 2와 `error`만: 메시지대로 조치한다(설정 파일 경로, 소스 루트 등).

## 한계

- 정규식 기반이라 메서드의 타입 시그니처는 싣지 않는다. 필요하면 줄 번호 근처만 Read한다.
- tsconfig `paths` 별칭 import는 파일로 해석하지 않는다(패키지처럼 보인다).
- 데코레이터 경로가 문자열 리터럴이 아니면(객체·배열·상수) 경로를 비워 두고 `unparsed`에 알린다.
