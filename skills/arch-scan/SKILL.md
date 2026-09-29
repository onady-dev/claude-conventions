---
name: arch-scan
description: TypeScript/NestJS 코드가 클린 아키텍처 규칙(rules/clean-arch, 규칙 ID CA-*)을 지키는지 검사한다. 코드를 작성·수정한 뒤, 리뷰 전, 또는 사용자가 구조 위반·의존 방향·순환 의존·계층 점검을 요청할 때 실행한다. 스크립트가 import 그래프를 대조해 위반 목록만 JSON으로 돌려준다.
---

# arch-scan

스크립트가 프로젝트의 import 그래프를 만들고 계층 규칙과 대조해, 위반만 JSON으로 돌려준다.
AI는 파일을 하나씩 읽지 않고 결과를 규칙별로 정리해 보고한다.

## 실행

```bash
node "<이 스킬 폴더>/scripts/arch-scan.mjs" --root <프로젝트 루트>          # 변경 파일만 (기본)
node "<이 스킬 폴더>/scripts/arch-scan.mjs" --all --root <프로젝트 루트>    # 전체
```

- `--base <ref>`: 변경 기준(기본 `HEAD`). 브랜치 전체 변경은 `--base main`(main과의 분기 지점 기준)
- `--config <경로>`: `.claude/arch.json`이 아닌 설정 파일
- `--out <파일>`: 결과를 파일로 저장(전체 검사 결과가 클 때)
- 종료 코드: 0 신규 error 없음 / 1 신규 error 있음 / 2 스크립트 오류

## 절차

1. 실행한다. 코드를 방금 고쳤으면 기본 모드, 구조 점검 요청이면 `--all`.
2. 아래 형식으로 보고한다. 규칙 설명은 `~/.claude/rules/<rules[ID].doc>`의 해당 ID 절을 근거로 한다.
3. **코드는 고치지 않는다.** 사용자가 요청할 때만 고친다.
4. `baseline`에 넣을 후보는 제안만 한다. `.claude/arch.json` 수정은 사용자가 승인한 뒤에 한다.
- 분류 안 된 파일은 검사 대상이 아니므로, 그 수가 많으면 결과가 실제보다 적게 나온다는 점을 보고에 함께 적는다.

## 보고 형식

```
### 신규 위반 N건 (error E / warn W)
| 규칙 | 파일:줄 | 내용 | 수정 방향 |

### 기존 위반 (baseline) — 규칙별 개수만
### 분류 안 된 파일 N개 — arch.json layers 보강 제안
### 검토 후보 (reviewHints) — 큰 유스케이스 파일
```

- 신규 위반이 없으면 "신규 위반 없음"과 검사한 파일 수만 쓴다.
- `unparsed`가 있으면 "해석하지 못한 줄 N개(결과에 빠졌을 수 있음)"를 덧붙인다.

## 규칙별 수정 방향

| 규칙 | 수정 방향 |
| --- | --- |
| `CA-DEP-01` | 도메인이 필요로 하는 값은 서비스가 조회해 인자로 넘긴다 |
| `CA-DEP-02` | 공통 부분을 세 번째 모듈로 빼거나, 한쪽이 port를 정의하고 다른 쪽이 구현한다 |
| `CA-PURE-01` | 패키지 기능을 서비스로 옮기거나, 순수 패키지면 `domainAllowedPackages`에 등록한다 |
| `CA-PURE-02` | `import type`으로 바꾼다 |
| `CA-PURE-03` | 현재 시각·난수를 인자로 받는다 |
| `CA-EXT-01` | SDK 호출을 `externals`에 등록된 어댑터로 옮긴다 |
| `CA-EXT-02` | `*.port.ts`에 인터페이스와 토큰을 만들고 `@Inject(TOKEN)`으로 주입받는다 |
| `CA-CTRL-01` | 핸들러의 분기·가공을 서비스나 도메인 함수로 옮긴다 |
| `CA-CTRL-02` | repository 사용을 서비스로 옮기고 컨트롤러는 서비스만 주입받는다 |

## baseline 형식

`.claude/arch.json`의 `baseline`에 `{ "rule": "CA-CTRL-02", "file": "src/a.controller.ts", "count": 1, "reason": "이유" }`로 적는다.
`count`를 주면 그 파일의 같은 규칙 위반을 줄 번호순으로 `count`개까지만 기존 위반으로 보고, 넘는 위반은 신규로 보고한다. 생략하면 그 파일 전체를 기존으로 본다. 새 위반이 드러나도록 `count`는 현재 위반 개수와 같게 적는 것을 권장한다.
순환(`CA-DEP-02`)은 `file`에 결과의 `cycle:<모듈>,<모듈>` 값을 그대로 적는다.
