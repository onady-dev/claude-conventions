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

# 경계: 외부 시스템과 컨트롤러

경계는 우리 코드와 바깥 세계(HTTP 요청, 다른 시스템, DB)가 만나는 곳이다.
경계를 얇고 명확하게 두면 바깥이 바뀌어도 안쪽 코드가 흔들리지 않는다.

### CA-EXT-01 외부 SDK는 지정한 어댑터 파일에서만 import한다

- 규칙: 외부 시스템 SDK(결제, 푸시, 다른 사내 시스템 클라이언트 등)는 `arch.json`의 `externals`에 등록하고, 등록한 어댑터 파일에서만 import한다.
- 이유: SDK가 여러 파일에 퍼지면 교체·버전업·장애 대응 때 수정 범위를 알 수 없다.
- `import type`으로 SDK 타입만 가져와도 위반이다. SDK 타입이 안쪽으로 새면 교체할 때 수정 범위가 넓어진다(`CA-EXT-03`).
- 판정: 스크립트(`externals`에 등록한 패키지만 검사)

### CA-EXT-02 유스케이스는 어댑터를 직접 import하지 않고 port를 통한다

- 규칙: usecase 파일이 adapter 파일을 import하지 않는다. 필요한 기능은 port로 정의하고 DI로 주입받는다(`CA-DEP-03`).
- 이유: 다른 시스템은 가장 자주 바뀌고 테스트하기 가장 어렵다. port 뒤에 두면 테스트는 가짜 구현으로, 교체는 어댑터 하나로 끝난다.
- 나쁜 예: `import { CrmClient } from '../crm/crm.client'` 후 클래스 타입으로 주입
- 좋은 예: `@Inject(CUSTOMER_DIRECTORY) private readonly customers: CustomerDirectory`
- 판정: 스크립트

### CA-EXT-03 경계를 넘는 데이터는 안쪽 모양으로 바꾼다

- 규칙: 외부 API 응답, HTTP DTO, DB 행을 그대로 도메인 함수까지 넘기지 않는다. 어댑터(또는 유스케이스 입구)에서 안쪽이 쓰는 타입으로 바꾼다.
- 이유: 바깥 형식이 바뀔 때 수정이 경계 한 곳에서 끝난다.
- 판정: AI

### CA-CTRL-01 컨트롤러 핸들러는 짧게 유지한다

- 규칙: 핸들러는 입력 검증, 유스케이스 호출, 응답 변환만 한다. 본문 기본 상한은 15줄이다(`arch.json`의 `limits.controllerHandlerMaxLines`).
- 이유: 컨트롤러에 로직이 있으면 HTTP 없이 재사용하거나 테스트할 수 없다.
- 판정: 스크립트(warn)

### CA-CTRL-02 컨트롤러는 DB 접근 객체를 직접 주입하지 않는다

- 규칙: 컨트롤러 생성자에 `Repository`, `DataSource`, `EntityManager`(또는 `@InjectRepository`)를 주입하지 않는다. 서비스를 거친다.
- 이유: 컨트롤러가 DB를 직접 다루면 조회 규칙(권한, 개인정보 차단)이 서비스와 컨트롤러 두 곳으로 갈라진다.
- 판정: 스크립트
