# 클린 아키텍처 Rules · Skills 설계

- 작성일: 2026-09-29
- 상태: 설계 확정, 구현 계획 전
- 계기: 사내 NestJS 프로젝트의 모듈 구조를 분석하다가, 구조 규칙이 문서화되어 있지 않다는 것을 확인함. repository 레이어 도입 대신 규칙 문서화를 선택(코드 변경 없음)

## 1. 목표와 범위

여러 프로젝트에서 재사용할 두 가지를 만든다.

- **Rules**: AI가 코드를 작성할 때 따르는 클린 아키텍처 작성 규칙
- **Skills**: 스크립트가 먼저 코드를 읽어 필요한 메타데이터만 JSON으로 요약하고, AI는 그 요약을 받아 판단하는 작업 자동화(전처리 스크립트 패턴). AI가 파일을 직접 탐색하느라 컨텍스트를 소모하는 문제를 줄이는 것이 목적이다

첫 버전 범위:

| 포함 | 제외 |
| --- | --- |
| Rules(common + typescript) | scaffold 스킬(여러 파일 동시 생성) |
| 공통 추출기 | impact 스킬(변경 영향 분석) |
| context-pack 스킬 | hook·CI 연결 |
| arch-scan 스킬 | TypeScript 외 언어 |
| 설치 스크립트 | 기존 프로젝트 코드 수정 |

보류한 결정: **Rules가 기존 코드와 어떤 관계를 갖는지**(새 코드만 적용 / 점진 이전 등)는 arch-scan 결과를 본 뒤 정한다. 이 설계는 그 결정을 내리지 않는다.

## 2. 클린 아키텍처 해석

업무 규칙을 가운데 두고 DB·프레임워크·외부 API는 바깥에 두며, **import는 바깥에서 안쪽으로만 향한다.** 판단 기준은 폴더 이름이 아니라 import 방향이다.

### 2-1. 필수 원칙 (항상 강제)

1. 의존 방향 — 업무 규칙 코드는 프레임워크·ORM을 import하지 않는다
2. 순수 로직 분리 — 분기·계산·판정은 입력을 받아 결과를 돌려주는 함수로 뺀다. 시간·랜덤·DB 결과는 인자로 받는다
3. 외부 시스템 격리 — 다른 시스템(결제, 푸시 알림, 사내 다른 시스템 등)은 port(안쪽이 정의한 인터페이스) 뒤에 둔다
4. 얇은 컨트롤러 — 입력 검증, 유스케이스 호출, 응답 변환만 한다

### 2-2. 선택 원칙 (판단 기준을 충족할 때만)

1. 도메인 모델과 ORM 엔티티 분리
2. 기능 하나당 유스케이스 클래스 하나
3. repository port — (1) 3개 이상 모듈이 같은 테이블을 조회하거나 (2) 조회 시 반드시 지킬 규칙(개인정보 차단, 코드 변환 등)이 있을 때

### 2-3. 엔티티 참조 예외

순수 로직(도메인)은 ORM 엔티티를 **`import type`으로만** 참조할 수 있다. 일반 import는 금지한다.
판단 이유: `import type`은 실행 시점에 사라져 테스트 순수성이 유지되고, 엔티티마다 도메인 타입을 만드는 일은 선택 원칙 1에 해당하기 때문이다.

## 3. 저장소 구조와 설치

원본 저장소:

```
claude-conventions/
├── rules/clean-arch/
│   ├── common/
│   └── typescript/
├── skills/
│   ├── context-pack/{SKILL.md, scripts/context-pack.mjs}
│   └── arch-scan/{SKILL.md, scripts/arch-scan.mjs}
├── lib/extract.mjs          공통 추출기 원본
├── templates/arch.json      프로젝트 설정 견본
├── test/                    node:test 테스트와 fixture
├── docs/                    긴 설명·배경, 설계 문서
└── install.mjs
```

설치(`node install.mjs [--target <dir>]`, 기본 대상 `~/.claude`):

```
rules/clean-arch/     → <target>/rules/clean-arch/
skills/context-pack/  → <target>/skills/context-pack/
skills/arch-scan/     → <target>/skills/arch-scan/
lib/extract.mjs       → 각 스킬의 scripts/lib/extract.mjs (스킬마다 복사)
```

- 스킬 폴더는 자기 완결적이어야 하므로 공통 추출기를 스킬마다 복사한다. 원본은 `lib/` 한 곳
- 설치 스크립트는 Node로 작성한다(OS 무관)
- 설치한 폴더마다 표식 파일 `.installed-by-claude-conventions`를 둔다. 표식 없는 같은 이름 폴더가 있으면 **덮어쓰지 않고 중단**한다
- 같은 설치를 두 번 실행해도 결과가 같아야 한다

### 3-1. 기존 ecc 규칙과의 관계

`~/.claude/rules/ecc/common/patterns.md`는 Repository Pattern을 권한다. `rules/clean-arch/common/00-overview.md`에 "데이터 접근 계층에 관해서는 이 규칙이 우선한다"고 명시한다. ecc 파일은 플러그인 업데이트로 덮어써지므로 수정하지 않는다.

## 4. Rules 구성

작성 원칙:

- 규칙마다 ID(`CA-DEP-01` 등)를 붙인다. arch-scan 보고서가 같은 ID를 쓴다
- 규칙 하나 = 규칙 / 이유 / 나쁜 예·좋은 예 / 판정 기준(스크립트 검사 또는 AI 판단)
- 파일당 약 100줄 이내. 긴 설명은 `docs/`로
- 모든 파일에 `paths` frontmatter를 붙여 코드 파일을 다룰 때만 로드되게 한다
- 한국어로 작성하고 코드 식별자는 원형 유지

`common/` (언어 무관):

| 파일 | 내용 | ID |
| --- | --- | --- |
| `00-overview.md` | 목적, 필수·선택 구분, ecc 대비 우선 범위, `arch.json` 참조 | — |
| `dependency.md` | 4계층 정의, 의존성 규칙, 의존성 역전 | `CA-DEP-*` |
| `pure-logic.md` | 순수 로직 분리 기준, 시간·랜덤·DB 결과는 인자로 | `CA-PURE-*` |
| `boundaries.md` | 외부 시스템 격리, 경계 데이터 변환, 얇은 컨트롤러 | `CA-EXT-*`, `CA-CTRL-*` |
| `optional.md` | 선택 원칙 3가지와 도입 판단 기준 | `CA-OPT-*` |

`typescript/` (`paths: **/*.ts`):

| 파일 | 내용 |
| --- | --- |
| `nestjs-layers.md` | 파일 접미사 ↔ 계층 기본 대응, 모듈 구성 규칙 |
| `nestjs-ports.md` | `Symbol` 토큰, `@Inject(TOKEN)`, `useClass` 연결, 테스트용 가짜 |
| `typeorm.md` | 엔티티 위치, 트랜잭션 `manager` 전달, 도메인의 엔티티 `import type` 참조 |

## 5. 프로젝트 설정 `arch.json`

위치는 각 프로젝트의 `.claude/arch.json`. **없으면 NestJS 기본값으로 동작한다.** 스크립트 공통 옵션 `--config <경로>`로 다른 위치를 지정할 수 있다.

```jsonc
{
  "root": "src",
  "exclude": ["**/*.spec.ts", "src/migrations/**"],
  "layers": [
    { "layer": "framework", "match": ["src/main.ts", "src/app.module.ts", "**/*.module.ts"] },
    { "layer": "adapter",   "match": ["**/*.controller.ts", "src/commons/guards/**", "src/modules/payments/gateway/**"] },
    { "layer": "usecase",   "match": ["**/*.service.ts", "**/*.scheduler.ts", "**/*.port.ts"] },
    { "layer": "domain",    "match": ["**/*.policy.ts", "src/modules/orders/order-*.ts"] },
    { "layer": "entity",    "match": ["src/entities/**"] }
  ],
  "externals": {
    "stripe": ["src/modules/payments/stripe-payment.adapter.ts"],
    "axios":  ["src/modules/payments/gateway/**"]
  },
  "baseline": [
    { "rule": "CA-CTRL-02", "file": "src/modules/orders/bad-orders.controller.ts", "reason": "구조 전환 전 코드, 이전 일정 미정" }
  ]
}
```

- `layers`는 위에서부터 처음 일치한 규칙을 적용한다
- 어느 계층에도 속하지 않은 파일은 추정하지 않고 `unclassified`로 보고한다
- `baseline`(이미 알고 있는 위반)은 위반을 없애지 않고 "기존 위반"으로 분리만 한다
- 경로 패턴(`**`, `*`)은 스크립트 내부의 짧은 변환 함수로 처리한다. Node 22 `path.matchesGlob`은 실험 기능 경고가 출력에 섞이므로 쓰지 않는다

## 6. 공통 추출기 `lib/extract.mjs`

의존성 0(Node 내장 `fs`, `path`, `child_process`와 정규식). Node 22 이상.

처리 순서: 파일 수집(exclude 적용) → 주석 제거 → 파일별 추출 → import 경로 해석 → 정방향·역방향 의존 그래프.

파일별 추출 항목:

- 계층, 줄 수
- import: 대상 경로, `import type` 여부, 줄 번호 (여러 줄 import, `export ... from` 포함)
- 클래스: 이름, 데코레이터, 메서드(이름, 파라미터 이름, async 여부, 줄 번호). **타입 시그니처 전체는 뽑지 않는다**
- NestJS: `@Controller`·`@Get` 등 경로, `@UseGuards`, `@InjectRepository`, `forFeature([...])`, 모듈 `imports`/`providers`
- 엔티티: `@Column` 등 데코레이터 바로 아래 속성 이름과 타입
- `unparsed: [{ line, text }]` — 해석하지 못한 부분은 버리지 않고 드러낸다

설계 판단:

- 주석 제거는 문자 단위 상태 기계로 한다(문자열 안의 `//`를 보존하기 위해)
- 캐시를 두지 않는다(수백 파일 규모에서 1초 안팎, 캐시 무효화 버그 회피)
- 내부 import는 상대 경로만 해석한다. tsconfig `paths` 별칭 해석은 첫 버전에서 제외한다(검증 대상 실제 프로젝트는 내부 import가 전부 상대 경로임을 확인)

## 7. context-pack 스킬

```
node scripts/context-pack.mjs <대상> [--out 파일] [--config 경로]
  대상: 모듈 이름(orders) 또는 파일 경로
```

출력 JSON:

```json
{
  "module": "orders",
  "files": [{ "file": "orders.service.ts", "layer": "usecase", "lines": 0 }],
  "imports": ["auth", "payments"],
  "entities": { "Order": ["id", "status", "amount"] },
  "routes": [{ "method": "GET", "path": "api/orders/:id", "guards": ["SessionGuard"], "handler": "get" }],
  "services": { "OrdersService": ["get(id)"] },
  "pureExports": {},
  "dtos": { "CreateOrderDto": ["amount", "..."] },
  "specs": ["orders.service.spec.ts"],
  "usedBy": [],
  "unparsed": [],
  "truncated": false
}
```

- 출력이 약 20KB를 넘으면 메서드·컬럼을 이름만 남기고 `truncated: true`
- 파일 하나 해석 실패는 전체를 멈추지 않고 `unparsed`에 올린다
- 대상을 못 찾으면 종료 코드 2, `{ "error", "candidates": [비슷한 모듈 이름] }`

`SKILL.md` 절차:

1. 기존 모듈 수정·기능 추가 전, 또는 구조 질문을 받았을 때 먼저 실행한다
2. JSON이 답하는 내용(라우트, 의존, 컬럼)은 파일을 다시 열어 확인하지 않는다
3. 구현 세부가 필요한 파일만 줄 번호로 필요한 범위만 Read한다
4. `unparsed`·`truncated` 부분은 원본을 확인한다

## 8. arch-scan 스킬

검사 규칙:

| ID | 검사 | 심각도 |
| --- | --- | --- |
| `CA-DEP-01` | 계층 간 import 방향 위반(허용표 기준) | error |
| `CA-DEP-02` | 모듈 간 순환 의존 | error |
| `CA-PURE-01` | 도메인이 프레임워크·외부 패키지 import | error |
| `CA-PURE-02` | 도메인이 엔티티를 일반 import | error |
| `CA-PURE-03` | 도메인이 `new Date()`·`Date.now()`·`Math.random()` 직접 호출 | warn |
| `CA-EXT-01` | `externals` 패키지를 허용 파일 밖에서 import | error |
| `CA-EXT-02` | 유스케이스가 외부 시스템 어댑터를 port 없이 직접 import | error |
| `CA-CTRL-01` | 컨트롤러 핸들러 본문 N줄 초과(기본 15) | warn |
| `CA-CTRL-02` | 컨트롤러가 Repository·DataSource 직접 주입 | error |

계층 간 허용표(행이 import하는 쪽):

```
             domain   usecase   adapter    entity      framework
domain         O         X         X       type만 O        X
usecase        O         O      X(EXT-02)     O            O
adapter        O         O         O          O            O
framework      O         O         O          O            O
```

- 엔티티는 별도 계층. 유스케이스의 `Repository<Entity>` 사용은 선택 원칙이므로 허용한다
- port 인터페이스(`*.port.ts`)는 유스케이스 계층(안쪽이 소유)
- 스크립트로 판정할 수 없는 규칙은 검사하지 않는다. 500줄 초과 서비스를 `reviewHints`로 싣는다

```
node scripts/arch-scan.mjs [--changed | --all] [--base <git ref>] [--config 경로]
  --changed(기본): 기준 ref 대비 git diff + 새 파일
  --all: 전체
```

출력: `summary`(파일·분류·미분류 수, 규칙별 신규/기존 위반 수), `violations[]`(`rule`, `severity`, `file`, `line`, `from`, `to`, `baseline`), `cycles[]`, `unclassified[]`, `unparsed[]`, `reviewHints[]`.

종료 코드: 0 신규 error 없음 / 1 신규 error 있음 / 2 스크립트 오류.

`SKILL.md` 절차:

1. 실행 후 규칙 ID별로 묶어 신규·기존 위반을 나눠 보고한다. 규칙 문서 위치와 수정 방향을 붙인다
2. 코드는 수정하지 않는다(요청 시에만)
3. `baseline` 추가 후보는 제안만 하고, `arch.json` 수정은 승인 후에 한다

## 9. 검증

### 9-1. 단위 테스트 (`node --test`)

- `test/fixtures/mini-nest/`: 규칙 ID마다 위반 파일 1개 + 올바른 파일 1개. 결과가 정확히 그 위반만 나오는지 확인
- 주석 제거기: 문자열 안 `//`·`/*`, 템플릿 문자열, 여러 줄 import, `import type`, `export ... from`
- 경로 패턴 변환, import 경로 해석(`./x` → `x.ts` / `x/index.ts`)
- context-pack 결과를 기대 JSON과 비교

### 9-2. 실제 프로젝트 검증 (비공개 NestJS 프로젝트, 읽기 전용)

검증 대상은 수백 개 파일 규모의 비공개 실제 NestJS 프로젝트다. 검증용 `arch.json`은 scratch 폴더에 두고 `--config`로 넘기며, 대상 저장소에는 파일을 만들지 않는다. 구체적인 결과는 공개하지 않는다.

합격 기준: 아래 4개 항목을 스크립트 출력과 grep 등 수동 실측으로 각각 구해 대조했을 때 모두 일치해야 한다.

1. 한 모듈의 context-pack 엔티티 목록
2. 그 모듈의 context-pack Nest import 목록
3. 전체 `@Controller` 수(`src/modules` 전체)
4. arch-scan `CA-CTRL-02` 대상 파일 목록

컨텍스트 절감 측정: context-pack JSON 크기 ÷ 요약 대상 원본 파일 합계 크기.

예상 결과: 외부 연동 어댑터를 서비스가 직접 import하는 `CA-EXT-02`가 다수 나올 것으로 예상한다. 이 결과가 보류한 "기존 코드와의 관계" 결정의 근거가 된다.

### 9-3. 설치 검증

- `install.mjs --target <임시 폴더>`로 설치 위치 확인
- 표식 없는 같은 이름 폴더가 있으면 중단하는지, 두 번 실행해도 결과가 같은지 확인
- 통과 후에 실제 `~/.claude`에 설치

### 9-4. 완료 기준

1. 단위 테스트 전부 통과
2. 9-2의 4개 항목이 모두 수동 실측과 일치
3. 9-3 통과, `~/.claude`에 설치된 두 스킬이 검증 대상 실제 프로젝트에서 실제로 실행됨
