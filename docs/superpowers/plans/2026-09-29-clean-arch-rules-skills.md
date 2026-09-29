# 클린 아키텍처 Rules · Skills 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 여러 프로젝트에서 재사용할 클린 아키텍처 Rules(문서)와, 전처리 스크립트로 코드 메타데이터를 JSON으로 요약하는 Skills(context-pack, arch-scan)를 만들고 `~/.claude`에 설치한다.

**Architecture:** 의존성 0인 Node ESM 스크립트가 TypeScript 소스를 주석 제거 + 정규식으로 해석해 파일별 메타데이터(import, 클래스, 데코레이터, 멤버)와 의존 그래프를 만든다. context-pack은 그 결과를 모듈 단위 요약으로, arch-scan은 계층 규칙 위반 목록으로 가공한다. 설치 스크립트가 규칙 문서와 스킬 폴더(공통 lib 포함)를 `~/.claude`로 복사한다.

**Tech Stack:** Node.js 22 이상(ESM `.mjs`), `node:test`, `node:assert/strict`, `node:util.parseArgs`, git CLI

**설계 문서:** `docs/specs/2026-09-29-clean-arch-rules-skills-design.md`

## Global Constraints

- Node 22 이상. 외부 npm 의존성 0 — `package.json`에 `dependencies`/`devDependencies`를 두지 않는다
- 모든 스크립트는 ESM `.mjs`, 들여쓰기 2칸, 작은따옴표, 세미콜론
- 코드 주석·문서·오류 메시지·테스트 이름은 한국어. 코드 식별자는 영어
- 스크립트 출력은 **들여쓰기 없는 한 줄 JSON**(컨텍스트 절약). 종료 코드: 0 정상 / 1 arch-scan 신규 error 있음 / 2 스크립트 오류·대상 없음
- 규칙 ID는 다음 9개로 고정: `CA-DEP-01`, `CA-DEP-02`, `CA-PURE-01`, `CA-PURE-02`, `CA-PURE-03`, `CA-EXT-01`, `CA-EXT-02`, `CA-CTRL-01`, `CA-CTRL-02` (AI 판정 규칙 `CA-DEP-03`, `CA-PURE-04/05`, `CA-EXT-03`, `CA-OPT-01~03`은 문서에만 존재)
- 계층 이름: `domain`, `usecase`, `adapter`, `entity`, `framework`, 미분류는 `unclassified`
- 규칙 문서는 파일당 100줄 이내, 모두 `paths` frontmatter
- **검증 대상 실제 프로젝트에는 파일을 만들거나 고치지 않는다**(읽기 전용 검증)
- 커밋 메시지: 한국어 설명 + 영문 타입 접두어(`feat:`, `test:`, `docs:`, `chore:`). 모든 커밋 끝에 아래 줄을 붙인다(각 Task의 커밋 명령에 포함됨)
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  ```
- 모든 명령은 Git Bash에서 저장소 루트(`claude-conventions`)로 `cd` 한 뒤 실행한다

### 설계 문서 대비 구현 세부 결정 (계획 단계에서 확정)

1. 공통 추출기는 `lib/extract.mjs` 한 파일이 아니라 `lib/` 폴더의 여러 파일이고, `extract.mjs`는 재수출 입구다. 설치 시 `lib/` 폴더 전체를 각 스킬의 `scripts/lib/`로 복사한다(파일당 책임 하나를 유지하려고)
2. DTO(`*.dto.ts`, `dto/**`)는 usecase 계층으로 분류한다. 유스케이스의 입력 모양이라 유스케이스 소유이고, adapter로 두면 서비스의 DTO import가 전부 위반이 된다
3. `arch.json`에 `layers`를 쓰면 기본 layers를 통째로 대체한다(부분 병합하면 순서 규칙이 모호해진다). 다른 배열 항목도 대체, `limits`만 키 단위 병합
4. context-pack 출력에 설계 예시 외 `target`, `config`, `controllers`, `packageImports` 필드를 추가한다(`controllers`는 9-2 검증의 전체 컨트롤러 수 확인에 필요)
5. 순환 의존 위반의 `file`은 `cycle:<모듈>,<모듈>`(이름순)이고 baseline도 같은 문자열로 적는다
6. 유스케이스→어댑터 import는 `CA-DEP-01`이 아니라 `CA-EXT-02`로만 보고한다(허용표의 `X(EXT-02)` 표기)

## 파일 구조

```
claude-conventions/
├── package.json                  test 스크립트만
├── .gitattributes                LF 고정
├── README.md                     목적·설치·사용 (Task 10)
├── install.mjs                   설치 스크립트 (Task 10)
├── lib/
│   ├── text.mjs                  주석 제거, 괄호 짝, 최상위 분할, 줄 번호 (Task 1)
│   ├── sort.mjs                  결정적 정렬 도구 (Task 1)
│   ├── glob.mjs                  경로 패턴 → 정규식 (Task 2)
│   ├── config.mjs                arch.json 로드·검증·기본값 (Task 2)
│   ├── parse-imports.mjs         import/export 추출 (Task 3)
│   ├── nest-metadata.mjs         @Module 인자 해석 (Task 4)
│   ├── parse-classes.mjs         클래스·데코레이터·멤버 추출 (Task 4)
│   ├── parse.mjs                 파일 하나 해석 입구 (Task 4)
│   ├── files.mjs                 소스 파일 목록 (Task 5)
│   ├── resolve.mjs               import 경로 해석 (Task 5)
│   ├── project.mjs               프로젝트 로드·계층 분류·역방향 의존 (Task 5)
│   ├── context-pack.mjs          모듈 요약 가공 (Task 6)
│   ├── cli.mjs                   공통 CLI 실행기 (Task 6)
│   ├── arch-rules.mjs            규칙 메타데이터·파일 단위 검사 (Task 7)
│   ├── arch-scan.mjs             전체 검사·순환·요약 (Task 7)
│   ├── git.mjs                   변경 파일 목록 (Task 8)
│   └── extract.mjs               재수출 입구 (Task 5에서 만들고 Task 6·7·8에서 확장)
├── skills/
│   ├── context-pack/SKILL.md, scripts/context-pack.mjs   (Task 6)
│   └── arch-scan/SKILL.md, scripts/arch-scan.mjs         (Task 8)
├── rules/clean-arch/
│   ├── common/00-overview.md, dependency.md, pure-logic.md, boundaries.md, optional.md   (Task 9)
│   └── typescript/nestjs-layers.md, nestjs-ports.md, typeorm.md                          (Task 9)
├── templates/arch.json           (Task 2)
└── test/
    ├── helpers.mjs
    ├── fixtures/mini-nest/...    (Task 5)
    └── *.test.mjs
```

---

### Task 1: 저장소 기반과 텍스트 도구

**Files:**
- Create: `package.json`, `.gitattributes`, `lib/text.mjs`, `lib/sort.mjs`
- Test: `test/text.test.mjs`

**Interfaces:**
- Produces:
  - `stripComments(src: string, opts?: { blankStrings?: boolean }): string` — 주석(및 옵션 시 문자열 내용)을 공백으로 바꾼, **입력과 같은 길이**의 문자열. 줄바꿈은 보존
  - `makeLineIndex(text: string): (offset: number) => number` — 1부터 시작하는 줄 번호
  - `findClosing(bare: string, openIdx: number): number` — `(`/`[`/`{`/`<`의 짝 위치, 없으면 -1. 입력은 문자열이 비워진 텍스트
  - `splitTopLevel(bare: string, start: number, end: number, sep?: string): Array<[number, number]>` — 괄호 깊이 0의 구분자로 나눈 범위(빈 범위 제외)
  - `lineTextAt(text: string, offset: number): string` — 그 줄의 앞뒤 공백 제거 텍스트(최대 120자)
  - `compareStrings(a: string, b: string): number`, `sortKeys(obj: object): object` (`lib/sort.mjs`)

- [ ] **Step 1: 저장소 기반 파일 작성**

`package.json`:

```json
{
  "name": "claude-conventions",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "node --test \"test/*.test.mjs\""
  }
}
```

`.gitattributes`:

```
* text=auto eol=lf
```

- [ ] **Step 2: 실패하는 테스트 작성** — `test/text.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findClosing, lineTextAt, makeLineIndex, splitTopLevel, stripComments } from '../lib/text.mjs';
import { compareStrings, sortKeys } from '../lib/sort.mjs';

test('줄 주석과 블록 주석을 공백으로 바꾸고 길이와 줄바꿈을 유지한다', () => {
  const src = 'a // x\n/* y\n z */b';
  const out = stripComments(src);
  assert.equal(out.length, src.length);
  assert.equal(out.split('\n').length, 3);
  assert.equal(out.replace(/\s+/g, ''), 'ab');
});

test('문자열 안의 // 와 /* 는 주석으로 보지 않는다', () => {
  const src = "const u = 'http://x'; const v = \"/* no */\";";
  assert.equal(stripComments(src), src);
});

test('템플릿 문자열의 ${} 안 코드의 주석은 지우고 문자열 부분은 보존한다', () => {
  const src = 'const t = `a ${b /* c */} // d`;';
  assert.equal(stripComments(src), 'const t = `a ${b ' + ' '.repeat(7) + '} // d`;');
});

test('blankStrings는 문자열 내용만 공백으로 바꾸고 따옴표와 ${} 코드는 남긴다', () => {
  assert.equal(stripComments("x('ab') + `c${d}e`", { blankStrings: true }), "x('  ') + ` ${d} `");
});

test('이스케이프된 따옴표에서 문자열이 끝나지 않는다', () => {
  const src = "f('a\\'b') // c";
  assert.equal(stripComments(src), "f('a\\'b')" + ' '.repeat(5));
});

test('닫히지 않은 문자열은 줄 끝에서 끝난 것으로 본다', () => {
  const src = "const r = /['\"]/;\nconst x = 1; // c";
  assert.equal(stripComments(src).split('\n')[1].trimEnd(), 'const x = 1;');
});

test('오프셋을 1부터 시작하는 줄 번호로 바꾼다', () => {
  const lineOf = makeLineIndex('a\nbc\nd');
  assert.equal(lineOf(0), 1);
  assert.equal(lineOf(2), 2);
  assert.equal(lineOf(5), 3);
});

test('여는 괄호의 짝 위치를 찾는다', () => {
  assert.equal(findClosing('f(a, (b), [c])', 1), 13);
  const generic = 'Map<A, () => B>';
  assert.equal(findClosing(generic, 3), generic.length - 1);
  assert.equal(findClosing('f(a', 1), -1);
});

test('괄호 깊이 0의 쉼표로만 나눈다', () => {
  const s = 'a, fn(b, c), { d, e }, Map<K, V>, ';
  const parts = splitTopLevel(s, 0, s.length).map(([x, y]) => s.slice(x, y).trim());
  assert.deepEqual(parts, ['a', 'fn(b, c)', '{ d, e }', 'Map<K, V>']);
});

test('오프셋이 속한 줄의 텍스트를 돌려준다', () => {
  assert.equal(lineTextAt('a\n  import broken\nb', 4), 'import broken');
});

test('정렬 도구는 로케일과 무관하게 동작한다', () => {
  assert.deepEqual(['b', 'B', 'a'].sort(compareStrings), ['B', 'a', 'b']);
  assert.deepEqual(Object.keys(sortKeys({ z: 1, a: 2 })), ['a', 'z']);
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `node --test test/text.test.mjs`
Expected: FAIL — `Cannot find module '.../lib/text.mjs'`

- [ ] **Step 4: 구현** — `lib/sort.mjs`

```js
// 출력 JSON을 실행할 때마다 같게 만들기 위한 정렬 도구. localeCompare는 환경마다 결과가 달라 쓰지 않는다.

export function compareStrings(a, b) {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

export function sortKeys(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => compareStrings(a, b)));
}
```

`lib/text.mjs`:

```js
// 소스 텍스트를 구조 분석하기 위한 저수준 도구.
// stripComments는 입력과 같은 길이의 문자열을 돌려주므로, 결과의 오프셋과 줄 번호가 원본과 일치한다.
// 한계: 정규식 리터럴은 따로 인식하지 않는다. 안의 따옴표가 문자열로 오인되면 그 줄 끝에서 복구된다.

const PAIRS = { '(': ')', '[': ']', '{': '}', '<': '>' };

export function stripComments(src, { blankStrings = false } = {}) {
  const out = src.split('');
  const blank = (k) => {
    if (k < out.length && out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
  };
  const exprDepths = [];
  let mode = 'code';
  let depth = 0;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && d === '/') { blank(i); blank(i + 1); mode = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { blank(i); blank(i + 1); mode = 'block'; i += 2; continue; }
      if (c === "'" || c === '"') mode = c;
      else if (c === '`') mode = 'tpl';
      else if (c === '{') depth += 1;
      else if (c === '}') {
        if (exprDepths.length > 0 && exprDepths[exprDepths.length - 1] === depth) {
          exprDepths.pop();
          mode = 'tpl';
        } else {
          depth -= 1;
        }
      }
      i += 1;
      continue;
    }
    if (mode === 'line') {
      if (c === '\n') mode = 'code';
      else blank(i);
      i += 1;
      continue;
    }
    if (mode === 'block') {
      if (c === '*' && d === '/') { blank(i); blank(i + 1); mode = 'code'; i += 2; continue; }
      blank(i);
      i += 1;
      continue;
    }
    // 여기부터는 문자열(' ")이나 템플릿 문자열(`) 안이다
    if (c === '\\') {
      if (blankStrings) { blank(i); blank(i + 1); }
      i += 2;
      continue;
    }
    if (mode === 'tpl' && c === '$' && d === '{') { exprDepths.push(depth); mode = 'code'; i += 2; continue; }
    if ((mode === 'tpl' && c === '`') || c === mode || (mode !== 'tpl' && c === '\n')) {
      mode = 'code';
      i += 1;
      continue;
    }
    if (blankStrings) blank(i);
    i += 1;
  }
  return out.join('');
}

export function makeLineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

// bare: 문자열 내용이 비워진 텍스트여야 한다(문자열 안 괄호를 세지 않기 위해).
export function findClosing(bare, openIdx) {
  const open = bare[openIdx];
  const close = PAIRS[open];
  if (!close) return -1;
  let depth = 0;
  for (let i = openIdx; i < bare.length; i++) {
    const c = bare[i];
    if (open === '<' && c === '>' && bare[i - 1] === '=') continue; // 화살표 =>
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function splitTopLevel(bare, start, end, sep = ',') {
  const ranges = [];
  let depth = 0;
  let segStart = start;
  for (let i = start; i < end; i++) {
    const c = bare[i];
    if (c === '(' || c === '[' || c === '{' || c === '<') depth += 1;
    else if (c === ')' || c === ']' || c === '}' || (c === '>' && bare[i - 1] !== '=')) depth -= 1;
    else if (c === sep && depth === 0) {
      ranges.push([segStart, i]);
      segStart = i + 1;
    }
  }
  ranges.push([segStart, end]);
  return ranges.filter(([s, e]) => bare.slice(s, e).trim() !== '');
}

export function lineTextAt(text, offset) {
  const start = text.lastIndexOf('\n', offset - 1) + 1;
  const nl = text.indexOf('\n', offset);
  return text.slice(start, nl === -1 ? text.length : nl).trim().slice(0, 120);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test test/text.test.mjs`
Expected: PASS — `# pass 11`, `# fail 0`

- [ ] **Step 6: 커밋**

```bash
git add package.json .gitattributes lib/text.mjs lib/sort.mjs test/text.test.mjs
git commit -m "feat: 주석 제거와 괄호 짝 찾기 등 텍스트 분석 도구를 추가한다" -m 'Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>'
```

---

### Task 2: 경로 패턴과 arch.json 설정

**Files:**
- Create: `lib/glob.mjs`, `lib/config.mjs`, `templates/arch.json`
- Test: `test/glob-config.test.mjs`

**Interfaces:**
- Consumes: `stripComments` (Task 1)
- Produces:
  - `globToRegExp(pattern: string): RegExp`, `matchesAny(path: string, patterns: string[]): boolean` — 경로는 `/` 구분 상대 경로
  - `LAYERS: readonly string[]` = `['domain','usecase','adapter','entity','framework']`
  - `DEFAULT_CONFIG` — `{ root, modulesDir, exclude, layers: Array<{layer, match}>, externals: Record<string,string[]>, domainAllowedPackages: string[], baseline: Array<{rule, file, reason?}>, limits: { controllerHandlerMaxLines, largeServiceLines, contextPackMaxBytes } }`
  - `loadConfig({ projectRoot, configPath? }): Config` — `DEFAULT_CONFIG` 필드 + `source: string | null`(읽은 파일 절대 경로)

- [ ] **Step 1: 실패하는 테스트 작성** — `test/glob-config.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globToRegExp, matchesAny } from '../lib/glob.mjs';
import { DEFAULT_CONFIG, loadConfig } from '../lib/config.mjs';

const tmp = () => mkdtempSync(join(tmpdir(), 'cc-config-'));
const writeArch = (root, text) => {
  mkdirSync(join(root, '.claude'), { recursive: true });
  writeFileSync(join(root, '.claude', 'arch.json'), text);
};

test('** 는 0개 이상의 폴더, * 는 한 폴더 안의 글자와 맞는다', () => {
  assert.equal(matchesAny('src/main.ts', ['**/main.ts']), true);
  assert.equal(matchesAny('main.ts', ['**/main.ts']), true);
  assert.equal(matchesAny('src/a/b/x.service.ts', ['**/*.service.ts']), true);
  assert.equal(matchesAny('src/a/x.service.ts.bak', ['**/*.service.ts']), false);
  assert.equal(matchesAny('src/modules/shipping/rate-table.ts', ['src/modules/shipping/rate-*.ts']), true);
  assert.equal(matchesAny('src/modules/shipping/sub/rate-x.ts', ['src/modules/shipping/rate-*.ts']), false);
  assert.equal(matchesAny('src/migrations/1-a.ts', ['src/migrations/**']), true);
  assert.equal(matchesAny('src/modules/x/dto/a.dto.ts', ['**/dto/**']), true);
});

test('점과 괄호 같은 정규식 특수문자는 글자 그대로 비교한다', () => {
  assert.equal(globToRegExp('a.(b).ts').test('a.(b).ts'), true);
  assert.equal(globToRegExp('a.ts').test('abts'), false);
});

test('설정 파일이 없으면 기본값을 쓰고 source는 null이다', () => {
  const c = loadConfig({ projectRoot: tmp() });
  assert.equal(c.source, null);
  assert.deepEqual(c.layers, DEFAULT_CONFIG.layers);
});

test('주석이 있는 arch.json을 읽고 limits는 키 단위로 합친다', () => {
  const root = tmp();
  writeArch(root, '{\n  // 주석\n  "externals": { "stripe": ["src/a.ts"] },\n  "limits": { "controllerHandlerMaxLines": 20 }\n}');
  const c = loadConfig({ projectRoot: root });
  assert.deepEqual(c.externals, { stripe: ['src/a.ts'] });
  assert.equal(c.limits.controllerHandlerMaxLines, 20);
  assert.equal(c.limits.largeServiceLines, 500);
  assert.deepEqual(c.layers, DEFAULT_CONFIG.layers);
  assert.equal(c.source, join(root, '.claude', 'arch.json'));
});

test('layers를 주면 기본 layers를 통째로 대체한다', () => {
  const root = tmp();
  writeArch(root, '{ "layers": [{ "layer": "domain", "match": ["**/*.rule.ts"] }] }');
  assert.deepEqual(loadConfig({ projectRoot: root }).layers, [{ layer: 'domain', match: ['**/*.rule.ts'] }]);
});

test('알 수 없는 계층 이름은 오류다', () => {
  const root = tmp();
  writeArch(root, '{ "layers": [{ "layer": "service", "match": ["a"] }] }');
  assert.throws(() => loadConfig({ projectRoot: root }), /알 수 없는 계층 'service'/);
});

test('baseline 항목에 rule·file이 없으면 오류다', () => {
  const root = tmp();
  writeArch(root, '{ "baseline": [{ "rule": "CA-DEP-01" }] }');
  assert.throws(() => loadConfig({ projectRoot: root }), /baseline/);
});

test('--config로 지정한 파일이 없으면 오류다', () => {
  assert.throws(() => loadConfig({ projectRoot: tmp(), configPath: join(tmp(), 'none.json') }), /설정 파일이 없습니다/);
});

test('templates/arch.json은 읽을 수 있고 기본 layers와 같다', () => {
  const template = fileURLToPath(new URL('../templates/arch.json', import.meta.url));
  const c = loadConfig({ projectRoot: tmp(), configPath: template });
  assert.deepEqual(c.layers, DEFAULT_CONFIG.layers);
  assert.deepEqual(c.limits, DEFAULT_CONFIG.limits);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test test/glob-config.test.mjs`
Expected: FAIL — `Cannot find module '.../lib/glob.mjs'`

- [ ] **Step 3: 구현** — `lib/glob.mjs`

```js
// 경로 패턴(**, *, ?)을 정규식으로 바꾼다.
// Node 22의 path.matchesGlob은 실험 기능 경고가 출력에 섞이므로 쓰지 않는다.

const cache = new Map();

export function globToRegExp(pattern) {
  const hit = cache.get(pattern);
  if (hit) return hit;
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      const slashAfter = pattern[i + 2] === '/';
      re += slashAfter ? '(?:.*/)?' : '.*';
      i += slashAfter ? 2 : 1;
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  const compiled = new RegExp(`^${re}$`);
  cache.set(pattern, compiled);
  return compiled;
}

export function matchesAny(path, patterns) {
  return patterns.some((p) => globToRegExp(p).test(path));
}
```

`lib/config.mjs`:

```js
// 프로젝트별 설정(.claude/arch.json)을 읽는다. 파일이 없으면 NestJS 기본값으로 동작한다.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripComments } from './text.mjs';

export const LAYERS = Object.freeze(['domain', 'usecase', 'adapter', 'entity', 'framework']);

export const DEFAULT_CONFIG = Object.freeze({
  root: 'src',
  modulesDir: 'src/modules',
  exclude: ['**/*.spec.ts', '**/*.test.ts', '**/*.d.ts'],
  // 위에서부터 처음 맞는 규칙을 적용한다
  layers: [
    { layer: 'framework', match: ['**/main.ts', '**/*.module.ts'] },
    { layer: 'entity', match: ['**/*.entity.ts'] },
    {
      layer: 'adapter',
      match: [
        '**/*.controller.ts', '**/*.guard.ts', '**/*.strategy.ts', '**/*.middleware.ts', '**/*.filter.ts',
        '**/*.interceptor.ts', '**/*.adapter.ts', '**/*.client.ts', '**/*.repository.ts',
      ],
    },
    { layer: 'usecase', match: ['**/*.service.ts', '**/*.scheduler.ts', '**/*.port.ts', '**/*.dto.ts', '**/dto/**'] },
    { layer: 'domain', match: ['**/*.policy.ts', '**/*.domain.ts', '**/domain/**'] },
  ],
  externals: {},
  domainAllowedPackages: [],
  baseline: [],
  limits: { controllerHandlerMaxLines: 15, largeServiceLines: 500, contextPackMaxBytes: 20000 },
});

export function loadConfig({ projectRoot, configPath } = {}) {
  const path = configPath ? resolve(configPath) : join(projectRoot, '.claude', 'arch.json');
  if (!existsSync(path)) {
    if (configPath) throw new Error(`설정 파일이 없습니다: ${path}`);
    return { ...DEFAULT_CONFIG, source: null };
  }
  let user;
  try {
    user = JSON.parse(stripComments(readFileSync(path, 'utf8')));
  } catch (error) {
    throw new Error(`설정 파일을 읽지 못했습니다(${path}): ${error.message}`);
  }
  validate(user, path);
  return {
    ...DEFAULT_CONFIG,
    ...user,
    limits: { ...DEFAULT_CONFIG.limits, ...(user.limits ?? {}) },
    source: path,
  };
}

const isStringArray = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string');

function validate(user, path) {
  if (user === null || typeof user !== 'object' || Array.isArray(user)) {
    throw new Error(`설정 최상위는 객체여야 합니다: ${path}`);
  }
  if (user.layers !== undefined) {
    if (!Array.isArray(user.layers)) throw new Error('layers는 배열이어야 합니다');
    for (const entry of user.layers) {
      if (!LAYERS.includes(entry?.layer)) {
        throw new Error(`알 수 없는 계층 '${entry?.layer}' (허용: ${LAYERS.join(', ')})`);
      }
      if (!isStringArray(entry.match)) throw new Error(`계층 '${entry.layer}'의 match는 문자열 배열이어야 합니다`);
    }
  }
  for (const key of ['exclude', 'domainAllowedPackages']) {
    if (user[key] !== undefined && !isStringArray(user[key])) throw new Error(`${key}는 문자열 배열이어야 합니다`);
  }
  if (user.externals !== undefined && !Object.values(user.externals ?? {}).every(isStringArray)) {
    throw new Error('externals의 값은 문자열 배열이어야 합니다');
  }
  const baselineOk = user.baseline === undefined
    || (Array.isArray(user.baseline) && user.baseline.every((b) => typeof b?.rule === 'string' && typeof b?.file === 'string'));
  if (!baselineOk) throw new Error('baseline 항목에는 rule과 file 문자열이 필요합니다');
}
```

`templates/arch.json`:

```jsonc
{
  // 프로젝트의 .claude/arch.json으로 복사해 쓴다. 파일이 없으면 이 내용과 같은 기본값으로 동작한다.
  // 기본값과 다른 항목만 남기고 나머지는 지워도 된다.

  // 분석할 소스 루트와 기능 모듈 폴더(모듈 이름 = 이 폴더 바로 아래 폴더 이름)
  "root": "src",
  "modulesDir": "src/modules",

  // 분석에서 뺄 파일
  "exclude": ["**/*.spec.ts", "**/*.test.ts", "**/*.d.ts"],

  // 파일 → 계층. 위에서부터 처음 맞는 규칙을 적용한다. 이 항목을 쓰면 기본 layers를 통째로 대체한다
  "layers": [
    { "layer": "framework", "match": ["**/main.ts", "**/*.module.ts"] },
    { "layer": "entity", "match": ["**/*.entity.ts"] },
    {
      "layer": "adapter",
      "match": [
        "**/*.controller.ts", "**/*.guard.ts", "**/*.strategy.ts", "**/*.middleware.ts", "**/*.filter.ts",
        "**/*.interceptor.ts", "**/*.adapter.ts", "**/*.client.ts", "**/*.repository.ts"
      ]
    },
    { "layer": "usecase", "match": ["**/*.service.ts", "**/*.scheduler.ts", "**/*.port.ts", "**/*.dto.ts", "**/dto/**"] },
    { "layer": "domain", "match": ["**/*.policy.ts", "**/*.domain.ts", "**/domain/**"] }
  ],

  // 외부 SDK 패키지 → import를 허용할 어댑터 파일 (CA-EXT-01). 예: "stripe": ["src/modules/payments/stripe-payment.adapter.ts"]
  "externals": {},

  // 도메인에서 import를 허용할 순수 패키지 (CA-PURE-01 예외)
  "domainAllowedPackages": [],

  // 이미 알고 있는 위반. 없애지 않고 '기존 위반'으로 분리만 한다. 예: { "rule": "CA-CTRL-02", "file": "src/a.controller.ts", "reason": "..." }
  "baseline": [],

  "limits": { "controllerHandlerMaxLines": 15, "largeServiceLines": 500, "contextPackMaxBytes": 20000 }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test test/glob-config.test.mjs`
Expected: PASS — `# pass 9`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add lib/glob.mjs lib/config.mjs templates/arch.json test/glob-config.test.mjs
git commit -m "feat: 경로 패턴 매칭과 arch.json 설정 로더를 추가한다" -m 'Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>'
```

---

### Task 3: import · export 추출

**Files:**
- Create: `lib/parse-imports.mjs`
- Test: `test/parse-imports.test.mjs`

**Interfaces:**
- Consumes: `stripComments`, `makeLineIndex`, `lineTextAt` (Task 1)
- Produces:
  - `parseImports(code: string, lineOf): { imports: ImportRef[], unparsed: Array<{line, text}> }`
    - `code`는 주석만 지운 텍스트(문자열 보존)
    - `ImportRef = { kind: 'import'|'export'|'side-effect', spec: string, typeOnly: boolean, names: Array<{local, imported, typeOnly}>, line: number }` — 소스 순서
    - `imported`는 기본 import면 `'default'`, 네임스페이스면 `'*'`
  - `parseExports(bare: string): Array<{ name: string, kind: 'function'|'const'|'class'|'interface'|'type'|'enum' }>` — `bare`는 문자열까지 비운 텍스트

- [ ] **Step 1: 실패하는 테스트 작성** — `test/parse-imports.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLineIndex, stripComments } from '../lib/text.mjs';
import { parseExports, parseImports } from '../lib/parse-imports.mjs';

const CODE = [
  "import { A, B as C } from './a';",
  "import type { T } from '../t';",
  "import D, { type E } from 'pkg';",
  "import * as ns from '@scope/lib/sub';",
  'import {',
  '  F,',
  '  G,',
  "} from './multi';",
  "import './side';",
  "export { H } from './h';",
  "export * from './all';",
  "import { type X, type Y } from './types';",
  'import broken',
].join('\n');

test('import 문의 대상·이름·type 여부·줄 번호를 소스 순서로 뽑는다', () => {
  const { imports } = parseImports(CODE, makeLineIndex(CODE));
  assert.deepEqual(imports.map((i) => i.spec), ['./a', '../t', 'pkg', '@scope/lib/sub', './multi', './side', './h', './all', './types']);
  assert.deepEqual(imports[0].names, [
    { local: 'A', imported: 'A', typeOnly: false },
    { local: 'C', imported: 'B', typeOnly: false },
  ]);
  assert.equal(imports[1].typeOnly, true);
  assert.equal(imports[2].typeOnly, false);
  assert.deepEqual(imports[2].names, [
    { local: 'D', imported: 'default', typeOnly: false },
    { local: 'E', imported: 'E', typeOnly: true },
  ]);
  assert.deepEqual(imports[3].names, [{ local: 'ns', imported: '*', typeOnly: false }]);
  assert.equal(imports[4].line, 5);
  assert.deepEqual(imports[4].names.map((n) => n.local), ['F', 'G']);
  assert.equal(imports[5].kind, 'side-effect');
  assert.equal(imports[6].kind, 'export');
  assert.deepEqual(imports[7].names, []);
  assert.equal(imports[8].typeOnly, true);
});

test('해석하지 못한 import 줄은 unparsed로 드러낸다', () => {
  const { unparsed } = parseImports(CODE, makeLineIndex(CODE));
  assert.deepEqual(unparsed, [{ line: 13, text: 'import broken' }]);
});

test('주석 처리된 import와 동적 import()는 무시한다', () => {
  const code = stripComments("// import { Z } from './z';\nconst m = await import('./dyn');\n");
  const result = parseImports(code, makeLineIndex(code));
  assert.deepEqual(result, { imports: [], unparsed: [] });
});

test('export 선언의 이름과 종류를 뽑는다', () => {
  const bare = stripComments(
    [
      'export function a() {}',
      'export const b = 1;',
      'export async function c() {}',
      'export default class D {}',
      'export interface E {}',
      'export type F = string;',
      'export enum G { X }',
      "export { H } from './h';",
    ].join('\n'),
    { blankStrings: true },
  );
  assert.deepEqual(parseExports(bare), [
    { name: 'a', kind: 'function' },
    { name: 'b', kind: 'const' },
    { name: 'c', kind: 'function' },
    { name: 'D', kind: 'class' },
    { name: 'E', kind: 'interface' },
    { name: 'F', kind: 'type' },
    { name: 'G', kind: 'enum' },
  ]);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test test/parse-imports.test.mjs`
Expected: FAIL — `Cannot find module '.../lib/parse-imports.mjs'`

- [ ] **Step 3: 구현** — `lib/parse-imports.mjs`

```js
// import/export 문을 정규식으로 뽑는다.
// import 절 모양을 정확히 제한해, 앞 문장과 뒤 문장의 from이 이어 붙는 오인을 막는다.

import { lineTextAt } from './text.mjs';

const CLAUSE = String.raw`(\{[^}]*\}|\*(?:\s+as\s+[\w$]+)?|[\w$]+(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+[\w$]+))?)`;
const FROM_RE = new RegExp(String.raw`^[ \t]*(import|export)\s+(type\s+)?${CLAUSE}\s*from\s*(['"])([^'"\n]+)\4`, 'gm');
const SIDE_EFFECT_RE = /^[ \t]*import\s*(['"])([^'"\n]+)\1/gm;
const IMPORT_LINE_RE = /^[ \t]*import\b(?!\s*\()/gm;
const EXPORT_RE = /^[ \t]*export\s+(?:default\s+)?(?:declare\s+)?(async\s+function|function|const|let|var|abstract\s+class|class|interface|type|enum)\s*\*?\s*([A-Za-z_$][\w$]*)/gm;
const EXPORT_KIND = {
  'async function': 'function',
  function: 'function',
  const: 'const',
  let: 'const',
  var: 'const',
  'abstract class': 'class',
  class: 'class',
  interface: 'interface',
  type: 'type',
  enum: 'enum',
};

export function parseImports(code, lineOf) {
  const found = [];
  for (const m of code.matchAll(FROM_RE)) {
    const typeAll = Boolean(m[2]);
    const names = parseClause(m[3], typeAll);
    found.push({
      kind: m[1],
      spec: m[5],
      typeOnly: typeAll || (names.length > 0 && names.every((n) => n.typeOnly)),
      names,
      line: lineOf(m.index),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  for (const m of code.matchAll(SIDE_EFFECT_RE)) {
    found.push({ kind: 'side-effect', spec: m[2], typeOnly: false, names: [], line: lineOf(m.index), start: m.index, end: m.index + m[0].length });
  }
  found.sort((a, b) => a.start - b.start);
  const unparsed = [];
  for (const m of code.matchAll(IMPORT_LINE_RE)) {
    const covered = found.some((f) => m.index >= f.start && m.index < f.end);
    if (!covered) unparsed.push({ line: lineOf(m.index), text: lineTextAt(code, m.index) });
  }
  return { imports: found.map(({ start, end, ...rest }) => rest), unparsed };
}

function parseClause(clause, typeAll) {
  const namespaceOnly = clause.match(/^\*\s+as\s+([\w$]+)$/);
  if (namespaceOnly) return [{ local: namespaceOnly[1], imported: '*', typeOnly: typeAll }];
  if (clause === '*') return [];
  const names = [];
  const braceAt = clause.indexOf('{');
  const head = braceAt === -1 ? clause : clause.slice(0, braceAt);
  for (const part of head.split(',').map((s) => s.trim()).filter(Boolean)) {
    const ns = part.match(/^\*\s+as\s+([\w$]+)$/);
    names.push(ns ? { local: ns[1], imported: '*', typeOnly: typeAll } : { local: part, imported: 'default', typeOnly: typeAll });
  }
  if (braceAt !== -1) {
    const inner = clause.slice(braceAt + 1, clause.lastIndexOf('}'));
    for (const spec of inner.split(',').map((s) => s.trim()).filter(Boolean)) {
      const m = spec.match(/^(type\s+)?([\w$]+)(?:\s+as\s+([\w$]+))?$/);
      if (m) names.push({ local: m[3] ?? m[2], imported: m[2], typeOnly: typeAll || Boolean(m[1]) });
    }
  }
  return names;
}

export function parseExports(bare) {
  return [...bare.matchAll(EXPORT_RE)].map((m) => ({ name: m[2], kind: EXPORT_KIND[m[1].replace(/\s+/g, ' ')] }));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test test/parse-imports.test.mjs`
Expected: PASS — `# pass 4`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add lib/parse-imports.mjs test/parse-imports.test.mjs
git commit -m "feat: import와 export 선언을 추출한다" -m 'Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>'
```

---

### Task 4: 클래스 · 데코레이터 · 멤버 추출과 파일 해석 입구

**Files:**
- Create: `lib/nest-metadata.mjs`, `lib/parse-classes.mjs`, `lib/parse.mjs`
- Test: `test/parse-classes.test.mjs`

**Interfaces:**
- Consumes: `stripComments`, `makeLineIndex`, `findClosing`, `splitTopLevel` (Task 1), `parseImports`, `parseExports` (Task 3)
- Produces:
  - `parseSource(src: string): Parsed`
    ```
    Parsed = {
      imports: ImportRef[],                       // Task 3과 같은 모양
      exports: Array<{ name, kind }>,
      classes: ClassInfo[],
      impureCalls: Array<{ call: 'new Date()'|'Date.now()'|'Math.random()', line }>,
      unparsed: Array<{ line, text }>,            // 줄 번호순
    }
    ClassInfo = {
      name, line,
      decorators: Array<{ name, args: string|null }>,   // args는 괄호 안 원문(주석 제거, 앞뒤 공백 제거)
      module: ModuleMeta | null,                        // @Module 클래스만
      ctor: { params: Param[], line } | null,
      methods: Array<{ name, line, decorators, visibility: 'public'|'private'|'protected', isStatic, isAsync, params: string[], bodyLines }>,
      props: Array<{ name, optional, type: string|null, decorators, line }>,
    }
    Param = { name, type: string|null, modifiers: string[], decorators: Array<{ name, args }> }
    ModuleMeta = { imports: string[], providers: string[], controllers: string[], exports: string[], forFeature: string[] }
    ```
  - `bodyLines` = 본문 `{`와 `}` 사이 줄 수(한 줄 본문은 0)
  - `ModuleMeta.imports`의 `forwardRef(() => X)`는 `X`, `TypeOrmModule.forFeature([...])`는 `forFeature`로 분리, `{ provide: T, ... }`는 `provide:T`

- [ ] **Step 1: 실패하는 테스트 작성** — `test/parse-classes.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSource } from '../lib/parse.mjs';

const CONTROLLER = `
@Controller('api/items')
@UseGuards(AuthGuard)
export class ItemsController {
  constructor(
    private readonly svc: ItemsService,
    @InjectRepository(Item) private readonly repo: Repository<Item>,
  ) {}

  @Get(':id')
  @Roles('ADMIN')
  async getOne(@Param('id') id: string): Promise<{ id: string }> {
    const x = { a: 1 };
    return this.svc.getOne(id, x);
  }

  private helper(a: number, b = 2): number { return a + b; }

  static create(): ItemsController { return null as never; }
}
`;

const ENTITY = `
@Entity('items')
export class Item {
  @PrimaryGeneratedColumn() id!: number;
  @Column({ type: 'varchar', length: 20 })
  name!: string;
  note?: string;
  #secret = 'x';
}
`;

const MODULE = `
@Module({
  imports: [
    // 주석
    TypeOrmModule.forFeature([A, B]),
    AuthModule,
    forwardRef(() => OtherModule),
    ThrottlerModule.forRoot({ imports: [X] }),
  ],
  controllers: [C1],
  providers: [S1, { provide: TOKEN, useClass: Impl }],
  exports: [S1],
})
export class FooModule {}
`;

test('클래스 데코레이터와 인자를 순서대로 뽑는다', () => {
  const [cls] = parseSource(CONTROLLER).classes;
  assert.equal(cls.name, 'ItemsController');
  assert.equal(cls.line, 4);
  assert.deepEqual(cls.decorators, [
    { name: 'Controller', args: "'api/items'" },
    { name: 'UseGuards', args: 'AuthGuard' },
  ]);
  assert.equal(cls.module, null);
});

test('생성자 파라미터의 이름·타입·데코레이터를 뽑는다', () => {
  const [cls] = parseSource(CONTROLLER).classes;
  assert.deepEqual(cls.ctor.params.map(({ name, type, decorators }) => ({ name, type, decorators })), [
    { name: 'svc', type: 'ItemsService', decorators: [] },
    { name: 'repo', type: 'Repository<Item>', decorators: [{ name: 'InjectRepository', args: 'Item' }] },
  ]);
  assert.deepEqual(cls.ctor.params[0].modifiers, ['private', 'readonly']);
});

test('메서드의 데코레이터·파라미터·가시성·본문 줄 수를 뽑는다', () => {
  const [cls] = parseSource(CONTROLLER).classes;
  const [getOne, helper, create] = cls.methods;
  assert.equal(cls.methods.length, 3);
  assert.deepEqual(getOne.decorators.map((d) => d.name), ['Get', 'Roles']);
  assert.deepEqual(getOne.params, ['id']);
  assert.equal(getOne.isAsync, true);
  assert.equal(getOne.visibility, 'public');
  assert.equal(getOne.bodyLines, 2);
  assert.equal(getOne.line, 12);
  assert.equal(helper.visibility, 'private');
  assert.deepEqual(helper.params, ['a', 'b']);
  assert.equal(helper.bodyLines, 0);
  assert.equal(create.isStatic, true);
});

test('속성의 이름·타입·데코레이터를 뽑는다', () => {
  const [cls] = parseSource(ENTITY).classes;
  assert.deepEqual(
    cls.props.map(({ name, type, optional, decorators }) => ({ name, type, optional, decorators: decorators.map((d) => d.name) })),
    [
      { name: 'id', type: 'number', optional: false, decorators: ['PrimaryGeneratedColumn'] },
      { name: 'name', type: 'string', optional: false, decorators: ['Column'] },
      { name: 'note', type: 'string', optional: true, decorators: [] },
      { name: '#secret', type: null, optional: false, decorators: [] },
    ],
  );
});

test('@Module 인자에서 imports·forFeature·providers를 분리한다', () => {
  const [cls] = parseSource(MODULE).classes;
  assert.deepEqual(cls.module, {
    imports: ['AuthModule', 'OtherModule', 'ThrottlerModule'],
    providers: ['S1', 'provide:TOKEN'],
    controllers: ['C1'],
    exports: ['S1'],
    forFeature: ['A', 'B'],
  });
});

test('클래스 본문에서 해석하지 못한 줄은 unparsed로 드러낸다', () => {
  const parsed = parseSource('export class A {\n  [key: string]: unknown;\n  ok(): void {}\n}\n');
  assert.deepEqual(parsed.unparsed, [{ line: 2, text: '[key: string]: unknown;' }]);
  assert.deepEqual(parsed.classes[0].methods.map((m) => m.name), ['ok']);
});

test('시간·랜덤 직접 호출을 찾되 주석과 문자열 안은 무시한다', () => {
  const src = "const a = Date.now();\nconst s = 'Math.random()'; // new Date()\nconst d = new Date(x);\nconst e = new Date();\n";
  assert.deepEqual(parseSource(src).impureCalls, [
    { call: 'Date.now()', line: 1 },
    { call: 'new Date()', line: 4 },
  ]);
});

test('문자열 안의 @와 class는 데코레이터·클래스로 보지 않는다', () => {
  const parsed = parseSource("const s = '@Injectable() export class Fake {}';\n");
  assert.deepEqual(parsed.classes, []);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test test/parse-classes.test.mjs`
Expected: FAIL — `Cannot find module '.../lib/parse.mjs'`

- [ ] **Step 3: 구현** — `lib/nest-metadata.mjs`

```js
// @Module({...}) 인자에서 imports·providers·controllers·exports를 뽑는다.
// 최상위 속성만 본다. forRoot({ imports: [...] }) 같은 안쪽 객체의 같은 이름 키는 무시된다.

import { findClosing, splitTopLevel } from './text.mjs';

const MODULE_KEYS = ['imports', 'providers', 'controllers', 'exports'];

export function parseModuleMetadata(bare, code, [start, end]) {
  const result = { imports: [], providers: [], controllers: [], exports: [], forFeature: [] };
  const objOpen = bare.indexOf('{', start);
  if (objOpen === -1 || objOpen >= end) return result;
  const objClose = findClosing(bare, objOpen);
  if (objClose === -1) return result;
  for (const [ps, pe] of splitTopLevel(bare, objOpen + 1, objClose)) {
    const key = bare.slice(ps, pe).match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*\[/)?.[1];
    if (!MODULE_KEYS.includes(key)) continue;
    const arrOpen = bare.indexOf('[', ps);
    const arrClose = findClosing(bare, arrOpen);
    if (arrClose === -1 || arrClose > pe) continue;
    for (const [as, ae] of splitTopLevel(bare, arrOpen + 1, arrClose)) {
      const entry = code.slice(as, ae).trim();
      const feature = key === 'imports' ? entry.match(/^TypeOrmModule\.forFeature\(\s*\[([\s\S]*)\]/) : null;
      if (feature) result.forFeature.push(...feature[1].split(',').map((s) => s.trim()).filter(Boolean));
      else result[key].push(entryName(entry));
    }
  }
  return result;
}

function entryName(entry) {
  const forward = entry.match(/^forwardRef\(\s*\(\)\s*=>\s*([\w$]+)\s*\)$/);
  if (forward) return forward[1];
  const provide = entry.match(/^\{[\s\S]*?\bprovide\s*:\s*([\w$.]+)/);
  if (provide) return `provide:${provide[1]}`;
  return entry.match(/^(?:\.\.\.)?[\w$]+/)?.[0] ?? entry;
}
```

`lib/parse-classes.mjs`:

```js
// 클래스 선언과 그 멤버(생성자·메서드·속성)를 뽑는다.
// 구조는 문자열을 비운 bare 텍스트에서 찾고, 인자·타입 원문은 같은 위치의 code 텍스트에서 읽는다.

import { findClosing, splitTopLevel } from './text.mjs';
import { parseModuleMetadata } from './nest-metadata.mjs';

const DECORATOR_RE = /@([A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*)*/g;
const CLASS_RE = /^[ \t]*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm;
const MEMBER_RE = /((?:(?:public|private|protected|static|readonly|async|override|abstract|declare|get|set)\s+)*)(constructor|#?[A-Za-z_$][\w$]*)\s*([?!])?\s*(<[^>(){};]*>)?\s*([(:=;])/y;
const PARAM_MODIFIERS_RE = /^\s*((?:(?:public|private|protected|readonly|override)\s+)*)/;
const VISIBILITY = ['public', 'private', 'protected'];
const PROP_CONTINUES = /[=|&,:(]/;

export function parseClasses(bare, code, lineOf, unparsed) {
  const decorators = collectDecorators(bare, code);
  const ctx = { bare, code, lineOf, unparsed, byStart: new Map(decorators.map((d) => [d.start, d])) };
  const classes = [];
  for (const m of bare.matchAll(CLASS_RE)) {
    const line = lineOf(m.index);
    const open = bare.indexOf('{', m.index + m[0].length);
    const close = open === -1 ? -1 : findClosing(bare, open);
    if (close === -1) {
      unparsed.push({ line, text: `class ${m[1]}: 본문을 찾지 못함` });
      continue;
    }
    const own = precedingDecorators(bare, decorators, m.index);
    const moduleDecorator = own.find((d) => d.name === 'Module' && d.argsRange);
    classes.push({
      name: m[1],
      line,
      decorators: own.map(publicDecorator),
      module: moduleDecorator ? parseModuleMetadata(bare, code, moduleDecorator.argsRange) : null,
      ...parseMembers(ctx, open, close),
    });
  }
  return classes;
}

function collectDecorators(bare, code) {
  const list = [];
  for (const m of bare.matchAll(DECORATOR_RE)) {
    let end = m.index + m[0].length;
    let j = end;
    while (j < bare.length && /\s/.test(bare[j])) j += 1;
    let args = null;
    let argsRange = null;
    if (bare[j] === '(') {
      const close = findClosing(bare, j);
      if (close !== -1) {
        args = code.slice(j + 1, close).trim();
        argsRange = [j + 1, close];
        end = close + 1;
      }
    }
    list.push({ name: m[1], args, argsRange, start: m.index, end });
  }
  return list;
}

// pos 바로 앞에 공백만 사이에 두고 이어진 데코레이터들
function precedingDecorators(bare, decorators, pos) {
  const own = [];
  let cursor = pos;
  for (let k = decorators.length - 1; k >= 0; k--) {
    const d = decorators[k];
    if (d.end > cursor) continue;
    if (bare.slice(d.end, cursor).trim() !== '') break;
    own.unshift(d);
    cursor = d.start;
  }
  return own;
}

const publicDecorator = ({ name, args }) => ({ name, args });

function parseMembers(ctx, open, close) {
  const { bare, byStart } = ctx;
  const methods = [];
  const props = [];
  let ctor = null;
  let pending = [];
  let i = open + 1;
  while (i < close) {
    const c = bare[i];
    if (c === ';' || /\s/.test(c)) { i += 1; continue; }
    const decorator = c === '@' ? byStart.get(i) : undefined;
    if (decorator) {
      pending.push(publicDecorator(decorator));
      i = decorator.end;
      continue;
    }
    MEMBER_RE.lastIndex = i;
    const m = MEMBER_RE.exec(bare);
    const member = !m ? null : m[5] === '(' ? parseMethod(ctx, m, close, pending) : parseProp(ctx, m, close, pending);
    if (!member) {
      i = skipLine(ctx, i, close);
      pending = [];
      continue;
    }
    if (member.kind === 'ctor') ctor = member.value;
    else if (member.kind === 'method') methods.push(member.value);
    else props.push(member.value);
    i = member.next;
    pending = [];
  }
  return { ctor, methods, props };
}

function parseMethod(ctx, m, close, decorators) {
  const { bare, lineOf } = ctx;
  const modifiers = m[1].trim().split(/\s+/).filter(Boolean);
  const name = m[2];
  const paramsOpen = m.index + m[0].length - 1;
  const paramsClose = findClosing(bare, paramsOpen);
  if (paramsClose === -1 || paramsClose > close) return null;
  const params = parseParams(ctx, paramsOpen, paramsClose);
  const body = findBody(bare, paramsClose + 1, close);
  const line = lineOf(m.index);
  if (name === 'constructor') return { kind: 'ctor', value: { params, line }, next: body.next };
  return {
    kind: 'method',
    value: {
      name,
      line,
      decorators,
      visibility: name.startsWith('#') ? 'private' : (modifiers.find((x) => VISIBILITY.includes(x)) ?? 'public'),
      isStatic: modifiers.includes('static'),
      isAsync: modifiers.includes('async'),
      params: params.map((p) => p.name),
      bodyLines: body.open === -1 ? 0 : Math.max(0, lineOf(body.close) - lineOf(body.open) - 1),
    },
    next: body.next,
  };
}

// 반환 타입을 건너뛰고 메서드 본문 { } 를 찾는다. ':' '|' '&' '=>' 바로 뒤의 { 는 객체 타입이다.
function findBody(bare, from, limit) {
  let i = from;
  let expectType = false;
  while (i < limit) {
    const c = bare[i];
    if (/\s/.test(c)) { i += 1; continue; }
    if (c === '{' && !expectType) {
      const close = findClosing(bare, i);
      return close === -1 || close > limit ? { open: -1, close: -1, next: limit } : { open: i, close, next: close + 1 };
    }
    if (c === ';') return { open: -1, close: -1, next: i + 1 };
    if (c === ':' || c === '|' || c === '&') { expectType = true; i += 1; continue; }
    if (c === '=' && bare[i + 1] === '>') { expectType = true; i += 2; continue; }
    if ('([{<'.includes(c)) {
      const close = findClosing(bare, i);
      if (close === -1 || close > limit) return { open: -1, close: -1, next: limit };
      i = close + 1;
      expectType = false;
      continue;
    }
    expectType = false;
    i += 1;
  }
  return { open: -1, close: -1, next: limit };
}

function parseParams(ctx, open, close) {
  const { bare, code, byStart } = ctx;
  return splitTopLevel(bare, open + 1, close).map(([s, e]) => {
    const decorators = [];
    let i = s;
    for (;;) {
      while (i < e && /\s/.test(bare[i])) i += 1;
      const d = byStart.get(i);
      if (!d || d.end > e) break;
      decorators.push(publicDecorator(d));
      i = d.end;
    }
    const raw = code.slice(i, e);
    const modifierMatch = raw.match(PARAM_MODIFIERS_RE);
    const modifiers = modifierMatch[1].trim().split(/\s+/).filter(Boolean);
    const rest = raw.slice(modifierMatch[0].length);
    const nameMatch = rest.match(/^(?:\.\.\.)?\s*([A-Za-z_$][\w$]*|\{[\s\S]*?\}|\[[\s\S]*?\])/);
    const name = !nameMatch ? rest.trim() : /^[{[]/.test(nameMatch[1]) ? '{…}' : nameMatch[1];
    const typeMatch = rest.slice(nameMatch ? nameMatch[0].length : 0).match(/^\s*\??\s*:\s*([\s\S]*)$/);
    const type = typeMatch ? typeMatch[1].split(/\s=\s/)[0].trim() : null;
    return { name, type, modifiers, decorators };
  });
}

function parseProp(ctx, m, close, decorators) {
  const { bare, code, lineOf } = ctx;
  const tokIdx = m.index + m[0].length - 1;
  const end = findPropEnd(bare, tokIdx, close);
  const type = m[5] === ':' ? code.slice(tokIdx + 1, end).split(/\s=\s/)[0].trim() : null;
  return {
    kind: 'prop',
    value: { name: m[2], optional: m[3] === '?', type, decorators, line: lineOf(m.index) },
    next: end + 1,
  };
}

// 속성 선언의 끝: 깊이 0의 ';' 또는, 앞 글자가 이어짐을 뜻하지 않는 줄바꿈
function findPropEnd(bare, from, limit) {
  let depth = 0;
  for (let i = from; i < limit; i++) {
    const c = bare[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (depth === 0 && c === ';') return i;
    else if (depth === 0 && c === '\n' && !PROP_CONTINUES.test(bare.slice(from, i).trimEnd().slice(-1))) return i;
  }
  return limit - 1;
}

function skipLine(ctx, i, close) {
  const { bare, code, lineOf, unparsed } = ctx;
  const nl = bare.indexOf('\n', i);
  const end = nl === -1 || nl > close ? close : nl;
  unparsed.push({ line: lineOf(i), text: code.slice(i, end).trim().slice(0, 120) });
  return end + 1;
}
```

`lib/parse.mjs`:

```js
// 파일 하나를 해석하는 입구. 주석만 지운 code와 문자열까지 비운 bare를 만들어 각 추출기에 넘긴다.

import { parseClasses } from './parse-classes.mjs';
import { parseExports, parseImports } from './parse-imports.mjs';
import { makeLineIndex, stripComments } from './text.mjs';

const IMPURE_CALLS = [
  { re: /\bnew\s+Date\s*\(\s*\)/g, call: 'new Date()' },
  { re: /\bDate\.now\s*\(/g, call: 'Date.now()' },
  { re: /\bMath\.random\s*\(/g, call: 'Math.random()' },
];

export function parseSource(src) {
  const code = stripComments(src);
  const bare = stripComments(src, { blankStrings: true });
  const lineOf = makeLineIndex(src);
  const imported = parseImports(code, lineOf);
  const classUnparsed = [];
  const classes = parseClasses(bare, code, lineOf, classUnparsed);
  return {
    imports: imported.imports,
    exports: parseExports(bare),
    classes,
    impureCalls: findImpureCalls(bare, lineOf),
    unparsed: [...imported.unparsed, ...classUnparsed].sort((a, b) => a.line - b.line),
  };
}

function findImpureCalls(bare, lineOf) {
  return IMPURE_CALLS
    .flatMap(({ re, call }) => [...bare.matchAll(re)].map((m) => ({ call, line: lineOf(m.index) })))
    .sort((a, b) => a.line - b.line);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test test/parse-classes.test.mjs`
Expected: PASS — `# pass 8`, `# fail 0`

- [ ] **Step 5: 전체 테스트 확인**

Run: `npm test`
Expected: PASS — `# fail 0`

- [ ] **Step 6: 커밋**

```bash
git add lib/nest-metadata.mjs lib/parse-classes.mjs lib/parse.mjs test/parse-classes.test.mjs
git commit -m "feat: 클래스와 데코레이터·멤버를 추출한다" -m 'Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>'
```

---

### Task 5: 프로젝트 로더와 테스트 fixture

**Files:**
- Create: `lib/files.mjs`, `lib/resolve.mjs`, `lib/project.mjs`, `lib/extract.mjs`
- Create: `test/helpers.mjs`, `test/fixtures/mini-nest/**` (아래 19개 파일)
- Test: `test/project.test.mjs`

**Interfaces:**
- Consumes: `loadConfig` (Task 2), `matchesAny` (Task 2), `parseSource` (Task 4), `compareStrings` (Task 1)
- Produces:
  - `listSourceFiles(projectRoot, config): string[]` — `config.root` 아래 `.ts`(`.d.ts` 제외, `exclude` 제외), 프로젝트 기준 `/` 경로, 정렬됨
  - `listSpecFiles(projectRoot, dirRel): string[]` — `dirRel` 아래 `*.spec.ts`·`*.test.ts`
  - `packageName(spec): string`, `resolveImport(fromFile, spec, fileSet): { kind: 'file', file } | { kind: 'package', name } | { kind: 'missing', spec }`
  - `loadProject({ projectRoot, configPath? }): Project`
    ```
    Project = {
      projectRoot, config,
      files: Map<string, FileInfo>,
      inEdges: Map<string, Array<{ from, typeOnly, line }>>,   // 그 파일을 import하는 쪽
    }
    FileInfo = { file, layer, lines, moduleDir: string|null, parsed: Parsed, refs: Array<ImportRef & { target }> }
    ```
  - `classify(file, config): string`, `moduleDirOf(file, config): string|null`, `moduleLabel(file, config): string`
    - `moduleDirOf('src/modules/orders/dto/a.ts')` = `'orders'`, modulesDir 밖이면 `null`
    - `moduleLabel('src/modules/audit/change-log.module.ts')` = `'audit/change-log'`, `moduleLabel('src/modules/auth/auth.module.ts')` = `'auth'`
  - `test/helpers.mjs`: `REPO`, `FIXTURE`(절대 경로), `loadFixture(): Project`

- [ ] **Step 1: fixture 작성** — 모든 파일은 `test/fixtures/mini-nest/` 아래. 규칙 위반을 의도적으로 넣은 가짜 NestJS 프로젝트다(실행하지 않고 해석만 한다)

`.claude/arch.json`:

```jsonc
{
  // 테스트용 설정: layers는 기본값을 쓴다
  "externals": { "stripe": ["src/modules/payments/stripe-payment.adapter.ts"] },
  "baseline": [
    { "rule": "CA-CTRL-02", "file": "src/modules/orders/bad-orders.controller.ts", "reason": "테스트용 기존 위반" }
  ]
}
```

`src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
void bootstrap();
```

`src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({ imports: [OrdersModule, PaymentsModule] })
export class AppModule {}
```

`src/common/auth.guard.ts`:

```ts
import { CanActivate, Injectable } from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
```

`src/entities/order.entity.ts`:

```ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  status!: string;

  @Column({ type: 'int' })
  amount!: number;

  createdLabel?: string;
}
```

`src/utils/misc-helper.ts` (어느 계층에도 맞지 않는 파일):

```ts
export function formatWon(amount: number): string {
  return `${amount.toLocaleString()}원`;
}
```

`src/modules/orders/orders.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../entities/order.entity';
import { PaymentsModule } from '../payments/payments.module';
import { BadOrdersController } from './bad-orders.controller';
import { LegacyOrdersService } from './legacy-orders.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    // 주문 테이블
    TypeOrmModule.forFeature([Order]),
    PaymentsModule,
  ],
  controllers: [OrdersController, BadOrdersController],
  providers: [OrdersService, LegacyOrdersService],
})
export class OrdersModule {}
```

`src/modules/orders/orders.controller.ts` (올바른 컨트롤러):

```ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('api/orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.svc.getOne(id);
  }

  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.svc.create(dto);
  }
}
```

`src/modules/orders/bad-orders.controller.ts` (위반: CA-CTRL-02 repository 직접 주입, CA-CTRL-01 핸들러 17줄):

```ts
import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../entities/order.entity';

@Controller('api/legacy-orders')
export class BadOrdersController {
  constructor(
    @InjectRepository(Order)
    private readonly repo: Repository<Order>,
  ) {}

  @Get()
  async list() {
    const rows = await this.repo.find();
    const result = [];
    for (const row of rows) {
      if (row.status === 'PAID') {
        result.push({ id: row.id, label: '결제 완료' });
      } else if (row.status === 'CANCELLED') {
        result.push({ id: row.id, label: '취소' });
      } else if (row.status === 'REFUNDED') {
        result.push({ id: row.id, label: '환불' });
      } else {
        result.push({ id: row.id, label: '대기' });
      }
    }
    const total = result.length;
    const paid = result.filter((r) => r.label === '결제 완료').length;
    const ratio = total === 0 ? 0 : paid / total;
    return { total, paid, ratio, result };
  }
}
```

`src/modules/orders/orders.service.ts` (올바른 유스케이스: 엔티티·도메인·port·DTO만 import):

```ts
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../entities/order.entity';
import {
  PAYMENT_GATEWAY,
  type PaymentGateway,
} from '../payments/payment-gateway.port';
import { CreateOrderDto } from './dto/create-order.dto';
import { totalWithTax } from './order-pricing.policy';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly repo: Repository<Order>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async getOne(id: string): Promise<Order | null> {
    return this.repo.findOneBy({ id: Number(id) });
  }

  async create(dto: CreateOrderDto): Promise<{ id: number; chargeId: string }> {
    const order = await this.repo.save({ status: 'NEW', amount: dto.qty * 1000 });
    const chargeId = await this.gateway.charge(totalWithTax(order, 0.1));
    return { id: order.id, chargeId };
  }

  private audit(message: string): void {
    this.log.push(message);
  }

  private readonly log: string[] = [];
}
```

`src/modules/orders/legacy-orders.service.ts` (위반: CA-EXT-02 어댑터 직접 import, CA-EXT-01 SDK를 허용 밖에서 import):

```ts
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
```

`src/modules/orders/order-pricing.policy.ts` (올바른 도메인: 엔티티를 type으로만, 주석·문자열 속 시간 호출은 무시되어야 함):

```ts
import type { Order } from '../../entities/order.entity';

// Date.now() 는 여기서 쓰지 않는다 (주석은 검사 대상이 아니다)
const LABEL = 'new Date() 는 문자열이라 검사 대상이 아니다';

export function totalWithTax(order: Order, rate: number): number {
  return Math.round(order.amount * (1 + rate));
}

export const TAX_LABEL = LABEL;
```

`src/modules/orders/order-expiry.policy.ts` (위반: CA-PURE-01, CA-PURE-02, CA-DEP-01, CA-PURE-03):

```ts
import { Injectable } from '@nestjs/common';
import { Order } from '../../entities/order.entity';
import { OrdersService } from './orders.service';

export type ExpiryDeps = { service: OrdersService; marker: typeof Injectable };

export function isExpired(order: Order, createdAtMs: number): boolean {
  return order.status === 'NEW' && Date.now() - createdAtMs > 86_400_000;
}
```

`src/modules/orders/dto/create-order.dto.ts`:

```ts
import { IsInt, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  item!: string;

  @IsInt()
  qty!: number;
}
```

`src/modules/orders/orders.service.spec.ts` (분석에서 빠지고 specs 목록에만 나와야 함):

```ts
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  it('exists', () => {
    expect(OrdersService).toBeDefined();
  });
});
```

`src/modules/orders/broken.ts` (해석 불가 import 줄):

```ts
import something
export const value = 1;
```

`src/modules/payments/payments.module.ts` (orders ↔ payments 순환을 만든다):

```ts
import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PAYMENT_GATEWAY } from './payment-gateway.port';
import { StripePaymentAdapter } from './stripe-payment.adapter';

@Module({
  imports: [OrdersModule],
  providers: [{ provide: PAYMENT_GATEWAY, useClass: StripePaymentAdapter }],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
```

`src/modules/payments/payment-gateway.port.ts`:

```ts
export interface PaymentGateway {
  charge(amount: number): Promise<string>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
```

`src/modules/payments/stripe-payment.adapter.ts`:

```ts
import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import type { PaymentGateway } from './payment-gateway.port';

@Injectable()
export class StripePaymentAdapter implements PaymentGateway {
  constructor(private readonly client: Stripe) {}

  async charge(amount: number): Promise<string> {
    const intent = await this.client.paymentIntents.create({ amount, currency: 'krw' });
    return intent.id;
  }
}
```

- [ ] **Step 2: 테스트 도우미 작성** — `test/helpers.mjs`

```js
import { fileURLToPath } from 'node:url';
import { loadProject } from '../lib/project.mjs';

export const REPO = fileURLToPath(new URL('..', import.meta.url));
export const FIXTURE = fileURLToPath(new URL('./fixtures/mini-nest', import.meta.url));
export const loadFixture = () => loadProject({ projectRoot: FIXTURE });
```

- [ ] **Step 3: 실패하는 테스트 작성** — `test/project.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, moduleDirOf, moduleLabel } from '../lib/project.mjs';
import { packageName, resolveImport } from '../lib/resolve.mjs';
import { DEFAULT_CONFIG } from '../lib/config.mjs';
import { loadFixture } from './helpers.mjs';

test('패키지 이름을 정규화한다', () => {
  assert.equal(packageName('@scope/lib/sub'), '@scope/lib');
  assert.equal(packageName('lodash/fp'), 'lodash');
  assert.equal(packageName('node:fs'), 'node:fs');
});

test('상대 경로를 그대로, .ts, /index.ts, .js→.ts 순서로 해석한다', () => {
  const files = new Set(['src/a/b.ts', 'src/a/c/index.ts']);
  assert.deepEqual(resolveImport('src/a/x.ts', './b', files), { kind: 'file', file: 'src/a/b.ts' });
  assert.deepEqual(resolveImport('src/a/x.ts', './b.js', files), { kind: 'file', file: 'src/a/b.ts' });
  assert.deepEqual(resolveImport('src/a/d/x.ts', '../c', files), { kind: 'file', file: 'src/a/c/index.ts' });
  assert.deepEqual(resolveImport('src/a/x.ts', './none', files), { kind: 'missing', spec: './none' });
  assert.deepEqual(resolveImport('src/a/x.ts', '@nestjs/common', files), { kind: 'package', name: '@nestjs/common' });
});

test('모듈 폴더와 모듈 라벨을 구한다', () => {
  assert.equal(moduleDirOf('src/modules/orders/dto/a.dto.ts', DEFAULT_CONFIG), 'orders');
  assert.equal(moduleDirOf('src/main.ts', DEFAULT_CONFIG), null);
  assert.equal(moduleLabel('src/modules/orders/orders.module.ts', DEFAULT_CONFIG), 'orders');
  assert.equal(moduleLabel('src/modules/audit/change-log.module.ts', DEFAULT_CONFIG), 'audit/change-log');
});

test('기본 layers로 fixture 파일을 계층에 분류한다', () => {
  const p = loadFixture();
  const layerOf = (f) => p.files.get(f).layer;
  assert.equal(layerOf('src/main.ts'), 'framework');
  assert.equal(layerOf('src/modules/orders/orders.module.ts'), 'framework');
  assert.equal(layerOf('src/entities/order.entity.ts'), 'entity');
  assert.equal(layerOf('src/modules/orders/orders.controller.ts'), 'adapter');
  assert.equal(layerOf('src/common/auth.guard.ts'), 'adapter');
  assert.equal(layerOf('src/modules/payments/stripe-payment.adapter.ts'), 'adapter');
  assert.equal(layerOf('src/modules/orders/orders.service.ts'), 'usecase');
  assert.equal(layerOf('src/modules/orders/dto/create-order.dto.ts'), 'usecase');
  assert.equal(layerOf('src/modules/payments/payment-gateway.port.ts'), 'usecase');
  assert.equal(layerOf('src/modules/orders/order-pricing.policy.ts'), 'domain');
  assert.equal(layerOf('src/utils/misc-helper.ts'), 'unclassified');
  assert.equal(classify('src/x/y.repository.ts', DEFAULT_CONFIG), 'adapter');
});

test('spec 파일은 분석 대상에서 빠지고 설정 파일 위치를 기록한다', () => {
  const p = loadFixture();
  assert.equal(p.files.has('src/modules/orders/orders.service.spec.ts'), false);
  assert.equal(p.files.size, 17);
  assert.match(p.config.source, /mini-nest[\\/]\.claude[\\/]arch\.json$/);
});

test('import를 파일·패키지로 해석해 refs에 싣는다', () => {
  const refs = loadFixture().files.get('src/modules/orders/orders.service.ts').refs;
  const port = refs.find((r) => r.spec === '../payments/payment-gateway.port');
  assert.deepEqual(port.target, { kind: 'file', file: 'src/modules/payments/payment-gateway.port.ts' });
  assert.equal(port.typeOnly, false);
  assert.deepEqual(refs.find((r) => r.spec === '@nestjs/typeorm').target, { kind: 'package', name: '@nestjs/typeorm' });
});

test('역방향 의존을 기록한다', () => {
  const p = loadFixture();
  const importers = p.inEdges.get('src/modules/orders/orders.module.ts').map((e) => e.from).sort();
  assert.deepEqual(importers, ['src/app.module.ts', 'src/modules/payments/payments.module.ts']);
});
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `node --test test/project.test.mjs`
Expected: FAIL — `Cannot find module '.../lib/project.mjs'`

- [ ] **Step 5: 구현** — `lib/files.mjs`

```js
// 분석 대상 소스 파일 목록. 경로는 프로젝트 루트 기준 '/' 구분 상대 경로로 통일한다.

import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { matchesAny } from './glob.mjs';
import { compareStrings } from './sort.mjs';

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git']);
const SPEC_RE = /\.(spec|test)\.ts$/;

export const toPosix = (p) => p.split(sep).join('/');

export function listSourceFiles(projectRoot, config) {
  const rootDir = join(projectRoot, config.root);
  if (!existsSync(rootDir)) throw new Error(`소스 루트가 없습니다: ${rootDir}`);
  return walk(rootDir)
    .map((abs) => toPosix(relative(projectRoot, abs)))
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && !matchesAny(f, config.exclude))
    .sort(compareStrings);
}

export function listSpecFiles(projectRoot, dirRel) {
  const dir = join(projectRoot, dirRel);
  if (!existsSync(dir)) return [];
  return walk(dir)
    .map((abs) => toPosix(relative(projectRoot, abs)))
    .filter((f) => SPEC_RE.test(f))
    .sort(compareStrings);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((ent) => {
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) return SKIP_DIRS.has(ent.name) ? [] : walk(abs);
    return ent.isFile() ? [abs] : [];
  });
}
```

`lib/resolve.mjs`:

```js
// import 경로를 프로젝트 파일 또는 패키지 이름으로 해석한다.
// 상대 경로만 파일로 본다. tsconfig paths 별칭은 해석하지 않는다(패키지로 보인다).

import { posix } from 'node:path';

export function packageName(spec) {
  if (spec.startsWith('node:')) return spec;
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

export function resolveImport(fromFile, spec, fileSet) {
  if (!spec.startsWith('.')) return { kind: 'package', name: packageName(spec) };
  const base = posix.normalize(posix.join(posix.dirname(fromFile), spec));
  const stem = base.replace(/\.(js|mjs|cjs)$/, '');
  for (const candidate of [base, `${stem}.ts`, `${stem}/index.ts`]) {
    if (fileSet.has(candidate)) return { kind: 'file', file: candidate };
  }
  return { kind: 'missing', spec };
}
```

`lib/project.mjs`:

```js
// 프로젝트 전체를 읽어 파일별 해석 결과, 계층, import 대상, 역방향 의존을 만든다.

import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { loadConfig } from './config.mjs';
import { listSourceFiles } from './files.mjs';
import { matchesAny } from './glob.mjs';
import { parseSource } from './parse.mjs';
import { resolveImport } from './resolve.mjs';

export function loadProject({ projectRoot, configPath } = {}) {
  const config = loadConfig({ projectRoot, configPath });
  const paths = listSourceFiles(projectRoot, config);
  const fileSet = new Set(paths);
  const files = new Map();
  for (const file of paths) {
    const src = readFileSync(join(projectRoot, file), 'utf8');
    const parsed = safeParse(src);
    files.set(file, {
      file,
      layer: classify(file, config),
      lines: src.split('\n').length,
      moduleDir: moduleDirOf(file, config),
      parsed,
      refs: parsed.imports.map((imp) => ({ ...imp, target: resolveImport(file, imp.spec, fileSet) })),
    });
  }
  const inEdges = new Map(paths.map((p) => [p, []]));
  for (const info of files.values()) {
    for (const ref of info.refs) {
      if (ref.target.kind === 'file') inEdges.get(ref.target.file).push({ from: info.file, typeOnly: ref.typeOnly, line: ref.line });
    }
  }
  return { projectRoot, config, files, inEdges };
}

// 파일 하나의 해석 실패가 전체 실행을 멈추지 않게 한다
function safeParse(src) {
  try {
    return parseSource(src);
  } catch (error) {
    return { imports: [], exports: [], classes: [], impureCalls: [], unparsed: [{ line: 0, text: `해석 실패: ${error.message}` }] };
  }
}

export function classify(file, config) {
  const hit = config.layers.find((entry) => matchesAny(file, entry.match));
  return hit ? hit.layer : 'unclassified';
}

export function moduleDirOf(file, config) {
  const prefix = `${config.modulesDir}/`;
  if (!file.startsWith(prefix)) return null;
  const rest = file.slice(prefix.length).split('/');
  return rest.length > 1 ? rest[0] : null;
}

// Nest 모듈 파일의 표시 이름. 폴더 이름과 파일 이름이 다르면 '폴더/파일'
export function moduleLabel(file, config) {
  const prefix = `${config.modulesDir}/`;
  if (!file.startsWith(prefix)) return file;
  const rel = file.slice(prefix.length);
  const dir = posix.dirname(rel);
  const base = posix.basename(rel).replace(/\.module\.ts$/, '').replace(/\.ts$/, '');
  return posix.basename(dir) === base ? dir : `${dir}/${base}`;
}
```

`lib/extract.mjs` (스킬 스크립트가 불러오는 입구. Task 6·7·8에서 한 줄씩 추가한다):

```js
// 스킬 스크립트가 불러오는 공통 추출기 입구.

export { loadConfig, DEFAULT_CONFIG, LAYERS } from './config.mjs';
export { loadProject, classify, moduleDirOf, moduleLabel } from './project.mjs';
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `node --test test/project.test.mjs`
Expected: PASS — `# pass 7`, `# fail 0`

(분석 대상 17 = fixture 19개에서 `.claude/arch.json`과 spec 1개를 뺀 수. 목록: main, app.module, common/auth.guard, entities/order.entity, utils/misc-helper 5개 + orders 폴더 9개(module, controller, bad-orders.controller, service, legacy-orders.service, order-pricing.policy, order-expiry.policy, dto/create-order.dto, broken) + payments 폴더 3개)

- [ ] **Step 7: 전체 테스트 확인 후 커밋**

Run: `npm test`
Expected: PASS — `# fail 0`

```bash
git add lib/files.mjs lib/resolve.mjs lib/project.mjs lib/extract.mjs test/helpers.mjs test/project.test.mjs test/fixtures
git commit -m "feat: 프로젝트를 읽어 계층 분류와 의존 그래프를 만든다" -m 'Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>'
```

---

### Task 6: context-pack 스킬

**Files:**
- Create: `lib/context-pack.mjs`, `lib/cli.mjs`, `skills/context-pack/scripts/context-pack.mjs`, `skills/context-pack/SKILL.md`
- Modify: `lib/extract.mjs` (재수출 2줄 추가)
- Test: `test/context-pack.test.mjs`

**Interfaces:**
- Consumes: `loadProject`, `moduleLabel` (Task 5), `listSpecFiles` (Task 5), `compareStrings`, `sortKeys` (Task 1)
- Produces:
  - `buildContextPack(project, target: string): Pack | { error: string, candidates: string[] }`
    ```
    Pack = {
      target, config: string|null,
      files: Array<{ file, layer, lines }>,
      imports: string[],            // Nest 모듈 import 중 프로젝트 내부 → moduleLabel
      packageImports: string[],     // Nest 모듈 import 중 패키지(forFeature 제외)
      entities: Record<string, string[]|null>,   // forFeature·@InjectRepository 엔티티 → 컬럼 이름(해석 불가 시 null)
      controllers: Array<{ class, path, file }>,
      routes: Array<{ method, path, handler, guards: string[], decorators?: string[], file, line }>,
      services: Record<string, string[]>,        // @Injectable 클래스 → 'name(p1, p2) :줄' (truncated면 'name')
      pureExports: Record<string, string[]>,     // domain 파일 → export 함수·상수 이름
      dtos: Record<string, string[]>,
      specs: string[], usedBy: string[],
      unparsed: Array<{ file, line, text }>,
      truncated: boolean,
    }
    ```
  - `runCli(main, { options?, allowPositionals?, argv? })` — `main({ values, positionals, projectRoot })`는 `{ result, exitCode }`를 돌려준다. 공통 옵션 `--root`, `--config`, `--out`. 예외는 `{ error }` + 종료 코드 2로 출력

- [ ] **Step 1: 실패하는 테스트 작성** — `test/context-pack.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildContextPack } from '../lib/context-pack.mjs';
import { FIXTURE, loadFixture } from './helpers.mjs';

const SCRIPT = fileURLToPath(new URL('../skills/context-pack/scripts/context-pack.mjs', import.meta.url));
const ORDERS = 'src/modules/orders';

test('모듈의 Nest import·엔티티 컬럼·사용처를 요약한다', () => {
  const pack = buildContextPack(loadFixture(), 'orders');
  assert.equal(pack.files.length, 9);
  assert.deepEqual(pack.imports, ['payments']);
  assert.deepEqual(pack.packageImports, []);
  assert.deepEqual(pack.entities, { Order: ['id', 'status', 'amount'] });
  assert.deepEqual(pack.usedBy, ['payments']);
  assert.deepEqual(pack.specs, [`${ORDERS}/orders.service.spec.ts`]);
  assert.equal(pack.truncated, false);
});

test('컨트롤러와 라우트를 경로·가드와 함께 뽑는다', () => {
  const pack = buildContextPack(loadFixture(), 'orders');
  assert.deepEqual(pack.controllers.map((c) => [c.class, c.path]), [
    ['BadOrdersController', 'api/legacy-orders'],
    ['OrdersController', 'api/orders'],
  ]);
  assert.deepEqual(pack.routes.map((r) => [r.method, r.path, r.handler, r.guards]), [
    ['GET', 'api/legacy-orders', 'list', []],
    ['GET', 'api/orders/:id', 'getOne', ['AuthGuard']],
    ['POST', 'api/orders', 'create', ['AuthGuard']],
  ]);
});

test('서비스는 public 메서드만 이름·파라미터·줄 번호로 싣는다', () => {
  const { services } = buildContextPack(loadFixture(), 'orders');
  assert.deepEqual(Object.keys(services), ['LegacyOrdersService', 'OrdersService']);
  assert.equal(services.OrdersService.length, 2);
  assert.match(services.OrdersService[0], /^getOne\(id\) :\d+$/);
  assert.match(services.OrdersService[1], /^create\(dto\) :\d+$/);
  assert.match(services.LegacyOrdersService[0], /^refund\(chargeId\) :\d+$/);
});

test('도메인 export·DTO 필드·해석 실패 줄을 싣는다', () => {
  const pack = buildContextPack(loadFixture(), 'orders');
  assert.deepEqual(pack.pureExports, {
    [`${ORDERS}/order-expiry.policy.ts`]: ['isExpired'],
    [`${ORDERS}/order-pricing.policy.ts`]: ['totalWithTax', 'TAX_LABEL'],
  });
  assert.deepEqual(pack.dtos, { CreateOrderDto: ['item', 'qty'] });
  assert.deepEqual(pack.unparsed, [{ file: `${ORDERS}/broken.ts`, line: 1, text: 'import something' }]);
});

test('파일 경로를 대상으로 줄 수 있다', () => {
  const pack = buildContextPack(loadFixture(), `${ORDERS}/order-pricing.policy.ts`);
  assert.deepEqual(pack.files.map((f) => f.file), [`${ORDERS}/order-pricing.policy.ts`]);
  assert.deepEqual(pack.usedBy, ['orders']);
});

test('대상을 못 찾으면 비슷한 모듈 이름을 후보로 준다', () => {
  const result = buildContextPack(loadFixture(), 'ordrs');
  assert.match(result.error, /대상을 찾지 못했습니다/);
  assert.deepEqual(result.candidates, ['orders']);
});

test('출력이 상한을 넘으면 메서드를 이름만 남기고 truncated를 표시한다', () => {
  const p = loadFixture();
  const small = { ...p, config: { ...p.config, limits: { ...p.config.limits, contextPackMaxBytes: 10 } } };
  const pack = buildContextPack(small, 'orders');
  assert.equal(pack.truncated, true);
  assert.deepEqual(pack.services.OrdersService, ['getOne', 'create']);
  assert.equal(pack.routes[0].decorators, undefined);
  assert.equal(pack.controllers.length, 2);
});

test('CLI는 한 줄 JSON을 출력하고 종료 코드 0을 돌려준다', () => {
  const r = spawnSync(process.execPath, [SCRIPT, 'orders', '--root', FIXTURE], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim().split('\n').length, 1);
  assert.deepEqual(JSON.parse(r.stdout).imports, ['payments']);
});

test('CLI는 대상을 못 찾거나 인자가 없으면 종료 코드 2를 돌려준다', () => {
  const missing = spawnSync(process.execPath, [SCRIPT, 'ordrs', '--root', FIXTURE], { encoding: 'utf8' });
  assert.equal(missing.status, 2);
  assert.deepEqual(JSON.parse(missing.stdout).candidates, ['orders']);
  const noArg = spawnSync(process.execPath, [SCRIPT, '--root', FIXTURE], { encoding: 'utf8' });
  assert.equal(noArg.status, 2);
  assert.match(JSON.parse(noArg.stdout).error, /사용법/);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test test/context-pack.test.mjs`
Expected: FAIL — `Cannot find module '.../lib/context-pack.mjs'`

- [ ] **Step 3: 구현** — `lib/context-pack.mjs`

```js
// 모듈(또는 파일) 하나의 구조를 AI가 파일을 열지 않고 읽을 수 있는 요약으로 가공한다.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { listSpecFiles } from './files.mjs';
import { moduleLabel } from './project.mjs';
import { compareStrings, sortKeys } from './sort.mjs';

const HTTP_DECORATORS = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Head', 'Options'];
const MESSAGE_DECORATORS = ['MessagePattern', 'EventPattern'];
const COLUMN_DECORATORS = [
  'Column', 'PrimaryColumn', 'PrimaryGeneratedColumn', 'CreateDateColumn', 'UpdateDateColumn', 'DeleteDateColumn', 'VersionColumn',
];

export function buildContextPack(project, target) {
  const scope = resolveTarget(project, target);
  if (scope.error) return scope;
  const infos = scope.files.map((f) => project.files.get(f));
  const acc = { imports: new Set(), packageImports: new Set(), entities: new Map(), controllers: [], routes: [], services: {}, pureExports: {}, dtos: {} };
  for (const info of infos) collectFile(project, info, acc);
  const pack = {
    target: scope.target,
    config: project.config.source,
    files: infos.map(({ file, layer, lines }) => ({ file, layer, lines })),
    imports: [...acc.imports].sort(compareStrings),
    packageImports: [...acc.packageImports].sort(compareStrings),
    entities: sortKeys(Object.fromEntries(acc.entities)),
    controllers: acc.controllers.sort((a, b) => compareStrings(a.class, b.class)),
    routes: acc.routes.sort((a, b) => compareStrings(a.file, b.file) || a.line - b.line),
    services: sortKeys(acc.services),
    pureExports: sortKeys(acc.pureExports),
    dtos: sortKeys(acc.dtos),
    specs: scope.specs,
    usedBy: usedBy(project, scope.files),
    unparsed: infos.flatMap((i) => i.parsed.unparsed.map((u) => ({ file: i.file, ...u }))),
    truncated: false,
  };
  return fitToLimit(pack, project.config.limits.contextPackMaxBytes);
}

function resolveTarget(project, target) {
  const normalized = target.replace(/\\/g, '/').replace(/^\.\//, '');
  if (normalized.endsWith('.ts')) {
    if (!project.files.has(normalized)) return notFound(project, normalized);
    const spec = normalized.replace(/\.ts$/, '.spec.ts');
    return { target: normalized, files: [normalized], specs: existsSync(join(project.projectRoot, spec)) ? [spec] : [] };
  }
  const files = [...project.files.values()].filter((i) => i.moduleDir === normalized).map((i) => i.file);
  if (files.length === 0) return notFound(project, normalized);
  return { target: normalized, files, specs: listSpecFiles(project.projectRoot, `${project.config.modulesDir}/${normalized}`) };
}

function notFound(project, target) {
  const names = [...new Set([...project.files.values()].map((i) => i.moduleDir).filter(Boolean))];
  const candidates = names
    .map((name) => ({ name, d: distance(name, target) }))
    .filter(({ name, d }) => d <= 3 || name.includes(target) || target.includes(name))
    .sort((a, b) => a.d - b.d || compareStrings(a.name, b.name))
    .slice(0, 5)
    .map(({ name }) => name);
  return { error: `대상을 찾지 못했습니다: ${target}`, candidates };
}

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = saved;
    }
  }
  return row[b.length];
}

function collectFile(project, info, acc) {
  const bindings = new Map(info.refs.flatMap((ref) => ref.names.map((n) => [n.local, ref.target])));
  for (const cls of info.parsed.classes) {
    if (cls.module) collectModule(project, cls.module, bindings, acc);
    collectInjectedEntities(project, cls, bindings, acc);
    const ctrl = cls.decorators.find((d) => d.name === 'Controller');
    if (ctrl) {
      collectController(info, cls, ctrl, acc);
      continue;
    }
    if (cls.decorators.some((d) => d.name === 'Injectable')) {
      acc.services[cls.name] = cls.methods
        .filter((m) => m.visibility === 'public' && !m.isStatic)
        .map((m) => `${m.name}(${m.params.join(', ')}) :${m.line}`);
    }
    if (/\/dto\//.test(info.file) || info.file.endsWith('.dto.ts')) acc.dtos[cls.name] = cls.props.map((p) => p.name);
  }
  if (info.layer === 'domain') {
    acc.pureExports[info.file] = info.parsed.exports.filter((e) => e.kind === 'function' || e.kind === 'const').map((e) => e.name);
  }
}

function collectModule(project, mod, bindings, acc) {
  for (const name of mod.imports) {
    const target = bindings.get(name);
    if (target?.kind === 'file') acc.imports.add(moduleLabel(target.file, project.config));
    else if (target?.kind === 'package') acc.packageImports.add(target.name);
  }
  for (const name of mod.forFeature) addEntity(project, name, bindings.get(name), acc);
}

function collectInjectedEntities(project, cls, bindings, acc) {
  for (const param of cls.ctor?.params ?? []) {
    const name = param.decorators.find((d) => d.name === 'InjectRepository')?.args?.trim();
    if (name) addEntity(project, name, bindings.get(name), acc);
  }
}

function addEntity(project, name, target, acc) {
  if (acc.entities.has(name)) return;
  const cls = target?.kind === 'file' ? project.files.get(target.file)?.parsed.classes.find((c) => c.name === name) : null;
  const columns = cls ? cls.props.filter((p) => p.decorators.some((d) => COLUMN_DECORATORS.includes(d.name))).map((p) => p.name) : null;
  acc.entities.set(name, columns);
}

function collectController(info, cls, ctrl, acc) {
  const base = firstString(ctrl.args) ?? '';
  const classGuards = guardsOf(cls.decorators);
  acc.controllers.push({ class: cls.name, path: base, file: info.file });
  for (const m of cls.methods) {
    const http = m.decorators.find((d) => HTTP_DECORATORS.includes(d.name));
    const msg = m.decorators.find((d) => MESSAGE_DECORATORS.includes(d.name));
    if (!http && !msg) continue;
    acc.routes.push({
      method: http ? http.name.toUpperCase() : 'MESSAGE',
      path: http ? joinPath(base, firstString(http.args) ?? '') : (msg.args ?? ''),
      handler: m.name,
      guards: [...classGuards, ...guardsOf(m.decorators)],
      decorators: m.decorators.filter((d) => d !== http && d !== msg && d.name !== 'UseGuards').map((d) => d.name),
      file: info.file,
      line: m.line,
    });
  }
}

const firstString = (args) => args?.match(/^\s*['"`]([^'"`]*)['"`]/)?.[1] ?? null;

const guardsOf = (decorators) => decorators
  .filter((d) => d.name === 'UseGuards')
  .flatMap((d) => (d.args ?? '').split(',').map((s) => s.trim()).filter(Boolean));

const joinPath = (a, b) => [a, b].filter(Boolean).join('/').replace(/\/{2,}/g, '/');

// 이 파일들을 import하는 바깥 모듈. 모듈 밖의 framework 파일(app.module, main)은 뺀다
function usedBy(project, files) {
  const inside = new Set(files);
  const labels = new Set();
  for (const f of files) {
    for (const edge of project.inEdges.get(f) ?? []) {
      if (inside.has(edge.from)) continue;
      const src = project.files.get(edge.from);
      if (src.moduleDir) labels.add(src.moduleDir);
      else if (src.layer !== 'framework') labels.add(src.file);
    }
  }
  return [...labels].sort(compareStrings);
}

const byteLength = (obj) => Buffer.byteLength(JSON.stringify(obj));

function fitToLimit(pack, maxBytes) {
  if (byteLength(pack) <= maxBytes) return pack;
  return {
    ...pack,
    truncated: true,
    services: Object.fromEntries(Object.entries(pack.services).map(([k, v]) => [k, v.map((s) => s.split('(')[0])])),
    routes: pack.routes.map(({ decorators, ...rest }) => rest),
  };
}
```

`lib/cli.mjs`:

```js
// 스킬 스크립트 공통 실행기: 인자 해석 → main 실행 → 한 줄 JSON 출력 → 종료 코드 설정.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const COMMON_OPTIONS = { root: { type: 'string' }, config: { type: 'string' }, out: { type: 'string' } };

export function runCli(main, { options = {}, allowPositionals = false, argv = process.argv.slice(2) } = {}) {
  let exitCode = 2;
  try {
    const { values, positionals } = parseArgs({ args: argv, options: { ...COMMON_OPTIONS, ...options }, allowPositionals, strict: true });
    const outcome = main({ values, positionals, projectRoot: resolve(values.root ?? process.cwd()) });
    emit(outcome.result, values.out);
    exitCode = outcome.exitCode;
  } catch (error) {
    emit({ error: error.message });
    exitCode = 2;
  }
  process.exitCode = exitCode;
}

function emit(result, out) {
  const json = JSON.stringify(result);
  if (!out) {
    process.stdout.write(`${json}\n`);
    return;
  }
  writeFileSync(out, json);
  process.stdout.write(`${JSON.stringify({ written: resolve(out), bytes: Buffer.byteLength(json) })}\n`);
}
```

`skills/context-pack/scripts/context-pack.mjs`:

```js
#!/usr/bin/env node
// 설치본은 같은 폴더의 lib/를, 원본 저장소에서는 저장소 루트의 lib/를 쓴다.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const installed = join(here, 'lib', 'extract.mjs');
const libEntry = existsSync(installed) ? installed : join(here, '..', '..', '..', 'lib', 'extract.mjs');
const { loadProject, buildContextPack, runCli } = await import(pathToFileURL(libEntry).href);

const USAGE = '사용법: context-pack.mjs <모듈 이름|파일 경로> [--root 프로젝트 루트] [--config arch.json 경로] [--out 결과 파일]';

runCli(({ values, positionals, projectRoot }) => {
  if (positionals.length !== 1) return { result: { error: USAGE }, exitCode: 2 };
  const project = loadProject({ projectRoot, configPath: values.config });
  const result = buildContextPack(project, positionals[0]);
  return { result, exitCode: result.error ? 2 : 0 };
}, { allowPositionals: true });
```

`lib/extract.mjs`에 두 줄 추가(기존 두 줄 아래):

```js
export { buildContextPack } from './context-pack.mjs';
export { runCli } from './cli.mjs';
```

- [ ] **Step 4: SKILL.md 작성** — `skills/context-pack/SKILL.md`

````markdown
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

- `<대상>`: 모듈 이름(`modulesDir` 바로 아래 폴더 이름, 기본 `src/modules/<이름>`) 또는 파일 경로(`src/modules/orders/order-pricing.ts`)
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
````

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test test/context-pack.test.mjs`
Expected: PASS — `# pass 9`, `# fail 0`

- [ ] **Step 6: 전체 테스트 확인 후 커밋**

Run: `npm test`
Expected: PASS — `# fail 0`

```bash
git add lib/context-pack.mjs lib/cli.mjs lib/extract.mjs skills/context-pack test/context-pack.test.mjs
git commit -m "feat: 모듈 구조를 JSON으로 요약하는 context-pack 스킬을 추가한다" -m 'Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>'
```

---

### Task 7: arch-scan 검사 로직

**Files:**
- Create: `lib/arch-rules.mjs`, `lib/arch-scan.mjs`
- Modify: `lib/extract.mjs` (재수출 1줄 추가)
- Test: `test/arch-scan.test.mjs`

**Interfaces:**
- Consumes: `Project`, `FileInfo` (Task 5), `matchesAny` (Task 2), `compareStrings`, `sortKeys` (Task 1)
- Produces:
  - `RULES: Record<ruleId, { severity: 'error'|'warn', doc: string, title: string }>` — `doc`은 `~/.claude/rules/` 기준 상대 경로(예: `clean-arch/common/dependency.md`). Task 9 문서 테스트가 이 값을 쓴다
  - `layerRule(fromLayer, toLayer, typeOnly): ruleId | null`
  - `runArchScan(project, { onlyFiles?: Set<string> | null }): Report`
    ```
    Report = {
      mode: 'all'|'changed', config,
      summary: { files, classified, unclassified, byRule: Record<ruleId, { new, baseline }>, newErrors, newWarnings },
      violations: Array<{ rule, severity, file, line, from?, to?, message, baseline: boolean }>,   // rule → file → line 순
      cycles: string[][],
      unclassified: string[],
      unparsed: Array<{ file, line, text }>,
      reviewHints: Array<{ file, lines, hint }>,
      rules: Record<ruleId, RULES[ruleId]>,   // 결과에 나온 규칙만
    }
    ```
  - `onlyFiles`가 있으면 그 파일이 import하는 쪽인 위반만, 순환은 그 파일의 모듈이 속한 것만 보고한다

- [ ] **Step 1: 실패하는 테스트 작성** — `test/arch-scan.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RULES, layerRule } from '../lib/arch-rules.mjs';
import { runArchScan } from '../lib/arch-scan.mjs';
import { loadFixture } from './helpers.mjs';

const ORDERS = 'src/modules/orders';
const keyOf = (v) => `${v.rule} ${v.file}`;

test('허용표대로 계층 간 import를 판정한다', () => {
  assert.equal(layerRule('domain', 'domain', false), null);
  assert.equal(layerRule('domain', 'entity', true), null);
  assert.equal(layerRule('domain', 'entity', false), 'CA-PURE-02');
  assert.equal(layerRule('domain', 'usecase', false), 'CA-DEP-01');
  assert.equal(layerRule('domain', 'adapter', true), 'CA-DEP-01');
  assert.equal(layerRule('domain', 'framework', false), 'CA-DEP-01');
  assert.equal(layerRule('domain', 'unclassified', false), null);
  assert.equal(layerRule('usecase', 'adapter', false), 'CA-EXT-02');
  assert.equal(layerRule('usecase', 'entity', false), null);
  assert.equal(layerRule('adapter', 'usecase', false), null);
  assert.equal(layerRule('framework', 'adapter', false), null);
});

test('fixture 전체 검사는 의도한 위반만 정확히 찾는다', () => {
  const report = runArchScan(loadFixture());
  assert.deepEqual(report.violations.map(keyOf), [
    `CA-CTRL-01 ${ORDERS}/bad-orders.controller.ts`,
    `CA-CTRL-02 ${ORDERS}/bad-orders.controller.ts`,
    `CA-DEP-01 ${ORDERS}/order-expiry.policy.ts`,
    'CA-DEP-02 cycle:orders,payments',
    `CA-EXT-01 ${ORDERS}/legacy-orders.service.ts`,
    `CA-EXT-02 ${ORDERS}/legacy-orders.service.ts`,
    `CA-PURE-01 ${ORDERS}/order-expiry.policy.ts`,
    `CA-PURE-02 ${ORDERS}/order-expiry.policy.ts`,
    `CA-PURE-03 ${ORDERS}/order-expiry.policy.ts`,
  ]);
  assert.equal(report.mode, 'all');
  assert.deepEqual(report.cycles, [['orders', 'payments']]);
});

test('baseline에 있는 위반은 기존 위반으로 분리하고 신규 개수에서 뺀다', () => {
  const report = runArchScan(loadFixture());
  const ctrl02 = report.violations.find((v) => v.rule === 'CA-CTRL-02');
  assert.equal(ctrl02.baseline, true);
  assert.deepEqual(report.summary.byRule['CA-CTRL-02'], { new: 0, baseline: 1 });
  assert.deepEqual(report.summary.byRule['CA-EXT-02'], { new: 1, baseline: 0 });
  assert.equal(report.summary.newErrors, 6);
  assert.equal(report.summary.newWarnings, 2);
});

test('요약에 파일 수·미분류·해석 실패를 싣는다', () => {
  const report = runArchScan(loadFixture());
  assert.equal(report.summary.files, 17);
  assert.equal(report.summary.unclassified, 2);
  assert.equal(report.summary.classified, 15);
  assert.deepEqual(report.unclassified, [`${ORDERS}/broken.ts`, 'src/utils/misc-helper.ts']);
  assert.deepEqual(report.unparsed, [{ file: `${ORDERS}/broken.ts`, line: 1, text: 'import something' }]);
  assert.deepEqual(report.reviewHints, []);
});

test('위반 항목에 위치와 내용을 싣고 나온 규칙의 메타데이터를 붙인다', () => {
  const report = runArchScan(loadFixture());
  const ext02 = report.violations.find((v) => v.rule === 'CA-EXT-02');
  assert.equal(ext02.line, 3);
  assert.equal(ext02.to, 'src/modules/payments/stripe-payment.adapter.ts');
  assert.equal(ext02.severity, 'error');
  const ctrl01 = report.violations.find((v) => v.rule === 'CA-CTRL-01');
  assert.match(ctrl01.message, /list 본문 17줄/);
  assert.equal(ctrl01.severity, 'warn');
  assert.deepEqual(Object.keys(report.rules).length, 9);
  assert.equal(report.rules['CA-DEP-01'].doc, RULES['CA-DEP-01'].doc);
});

test('큰 유스케이스 파일은 reviewHints에 싣는다', () => {
  const p = loadFixture();
  const tight = { ...p, config: { ...p.config, limits: { ...p.config.limits, largeServiceLines: 20 } } };
  const files = runArchScan(tight).reviewHints.map((h) => h.file);
  assert.deepEqual(files, [`${ORDERS}/orders.service.ts`]);
});

test('onlyFiles를 주면 그 파일의 위반과 그 모듈이 속한 순환만 보고한다', () => {
  const report = runArchScan(loadFixture(), { onlyFiles: new Set([`${ORDERS}/legacy-orders.service.ts`]) });
  assert.equal(report.mode, 'changed');
  assert.deepEqual(report.violations.map((v) => v.rule), ['CA-DEP-02', 'CA-EXT-01', 'CA-EXT-02']);
  assert.equal(report.summary.files, 1);
});

test('onlyFiles가 순환에 속하지 않은 모듈이면 순환을 보고하지 않는다', () => {
  const report = runArchScan(loadFixture(), { onlyFiles: new Set(['src/utils/misc-helper.ts']) });
  assert.deepEqual(report.violations, []);
  assert.deepEqual(report.cycles, []);
});
```

(`CA-EXT-02`의 line 3 = `legacy-orders.service.ts`의 세 번째 줄 `import { StripePaymentAdapter } ...`. `list` 본문 17줄 = `async list() {` 다음 줄부터 닫는 `}` 전 줄까지. `orders.service.ts`는 34줄(끝 줄바꿈 포함 `split('\n')` 기준 35)이고 다른 usecase 파일은 20줄 이하다)

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test test/arch-scan.test.mjs`
Expected: FAIL — `Cannot find module '.../lib/arch-rules.mjs'`

- [ ] **Step 3: 구현** — `lib/arch-rules.mjs`

```js
// 규칙 메타데이터와 파일 단위 검사. 규칙 문서(rules/clean-arch)의 ID와 1:1로 대응한다.

import { matchesAny } from './glob.mjs';

export const RULES = Object.freeze({
  'CA-DEP-01': { severity: 'error', doc: 'clean-arch/common/dependency.md', title: '도메인이 바깥 계층을 import' },
  'CA-DEP-02': { severity: 'error', doc: 'clean-arch/common/dependency.md', title: '모듈 간 순환 의존' },
  'CA-PURE-01': { severity: 'error', doc: 'clean-arch/common/pure-logic.md', title: '도메인이 외부 패키지를 import' },
  'CA-PURE-02': { severity: 'error', doc: 'clean-arch/common/pure-logic.md', title: '도메인이 엔티티를 일반 import' },
  'CA-PURE-03': { severity: 'warn', doc: 'clean-arch/common/pure-logic.md', title: '도메인이 시간·랜덤을 직접 호출' },
  'CA-EXT-01': { severity: 'error', doc: 'clean-arch/common/boundaries.md', title: '외부 SDK를 허용 파일 밖에서 import' },
  'CA-EXT-02': { severity: 'error', doc: 'clean-arch/common/boundaries.md', title: '유스케이스가 어댑터를 직접 import' },
  'CA-CTRL-01': { severity: 'warn', doc: 'clean-arch/common/boundaries.md', title: '컨트롤러 핸들러가 김' },
  'CA-CTRL-02': { severity: 'error', doc: 'clean-arch/common/boundaries.md', title: '컨트롤러가 DB 접근 객체를 직접 주입' },
});

const HANDLER_DECORATORS = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Head', 'Options', 'MessagePattern', 'EventPattern'];
const DB_INJECT_DECORATORS = ['InjectRepository', 'InjectDataSource', 'InjectEntityManager'];
const DB_TYPE_RE = /^(?:Repository|DataSource|EntityManager)\b/;

const violation = (rule, file, line, detail) => ({ rule, severity: RULES[rule].severity, file, line, ...detail });

// 허용표: 행이 import하는 쪽. domain과 usecase 행에만 금지 칸이 있다.
export function layerRule(fromLayer, toLayer, typeOnly) {
  if (fromLayer === 'domain') {
    if (toLayer === 'domain' || toLayer === 'unclassified') return null;
    if (toLayer === 'entity') return typeOnly ? null : 'CA-PURE-02';
    return 'CA-DEP-01';
  }
  if (fromLayer === 'usecase' && toLayer === 'adapter') return 'CA-EXT-02';
  return null;
}

export function checkImports(info, project) {
  return info.refs.flatMap((ref) => {
    if (ref.target.kind === 'package') return checkPackage(info, ref, project.config);
    if (ref.target.kind !== 'file') return [];
    const target = project.files.get(ref.target.file);
    const rule = layerRule(info.layer, target.layer, ref.typeOnly);
    if (!rule) return [];
    return [violation(rule, info.file, ref.line, { from: info.layer, to: target.file, message: `${info.layer} → ${target.layer}` })];
  });
}

function checkPackage(info, ref, config) {
  const name = ref.target.name;
  const found = [];
  const allowed = Object.hasOwn(config.externals, name) ? config.externals[name] : null;
  if (allowed && !matchesAny(info.file, allowed)) {
    found.push(violation('CA-EXT-01', info.file, ref.line, { to: name, message: `${name}은(는) ${allowed.join(', ')}에서만 import` }));
  }
  if (info.layer === 'domain' && !config.domainAllowedPackages.includes(name)) {
    found.push(violation('CA-PURE-01', info.file, ref.line, { to: name, message: `도메인에서 ${name} import` }));
  }
  return found;
}

export function checkImpure(info) {
  if (info.layer !== 'domain') return [];
  return info.parsed.impureCalls.map((c) => violation('CA-PURE-03', info.file, c.line, { message: `${c.call} 직접 호출` }));
}

export function checkControllers(info, config) {
  const max = config.limits.controllerHandlerMaxLines;
  return info.parsed.classes
    .filter((cls) => cls.decorators.some((d) => d.name === 'Controller'))
    .flatMap((cls) => [
      ...(cls.ctor?.params ?? []).filter(isDbInjection).map((p) => violation('CA-CTRL-02', info.file, cls.ctor.line, {
        to: p.type ?? p.name,
        message: `${cls.name}이(가) ${p.name} 주입`,
      })),
      ...cls.methods
        .filter((m) => m.decorators.some((d) => HANDLER_DECORATORS.includes(d.name)) && m.bodyLines > max)
        .map((m) => violation('CA-CTRL-01', info.file, m.line, { message: `${cls.name}.${m.name} 본문 ${m.bodyLines}줄 (상한 ${max})` })),
    ]);
}

const isDbInjection = (p) => p.decorators.some((d) => DB_INJECT_DECORATORS.includes(d.name)) || DB_TYPE_RE.test(p.type ?? '');
```

`lib/arch-scan.mjs`:

```js
// 프로젝트 전체(또는 변경 파일)의 규칙 위반을 모으고, 모듈 순환과 요약을 붙인다.

import { RULES, checkControllers, checkImports, checkImpure } from './arch-rules.mjs';
import { compareStrings, sortKeys } from './sort.mjs';

export function runArchScan(project, { onlyFiles = null } = {}) {
  const scanned = [...project.files.values()].filter((i) => onlyFiles === null || onlyFiles.has(i.file));
  const cycles = findModuleCycles(project, onlyFiles);
  const violations = [
    ...scanned.flatMap((i) => [...checkImports(i, project), ...checkImpure(i), ...checkControllers(i, project.config)]),
    ...cycles.map((mods) => ({
      rule: 'CA-DEP-02',
      severity: RULES['CA-DEP-02'].severity,
      file: `cycle:${mods.join(',')}`,
      line: 0,
      message: mods.join(' ↔ '),
    })),
  ]
    .map((v) => ({ ...v, baseline: isBaseline(v, project.config.baseline) }))
    .sort((a, b) => compareStrings(a.rule, b.rule) || compareStrings(a.file, b.file) || a.line - b.line);
  const { largeServiceLines } = project.config.limits;
  return {
    mode: onlyFiles === null ? 'all' : 'changed',
    config: project.config.source,
    summary: summarize(scanned, violations),
    violations,
    cycles,
    unclassified: scanned.filter((i) => i.layer === 'unclassified').map((i) => i.file),
    unparsed: scanned.flatMap((i) => i.parsed.unparsed.map((u) => ({ file: i.file, ...u }))),
    reviewHints: scanned
      .filter((i) => i.layer === 'usecase' && i.lines > largeServiceLines)
      .map((i) => ({ file: i.file, lines: i.lines, hint: '순수 로직으로 뺄 판정 코드가 있는지 검토(CA-PURE-04, CA-OPT-02)' })),
    rules: Object.fromEntries([...new Set(violations.map((v) => v.rule))].sort(compareStrings).map((id) => [id, RULES[id]])),
  };
}

const isBaseline = (v, baseline) => baseline.some((b) => b.rule === v.rule && b.file === v.file);

function summarize(scanned, violations) {
  const byRule = {};
  for (const v of violations) {
    const slot = byRule[v.rule] ?? { new: 0, baseline: 0 };
    const key = v.baseline ? 'baseline' : 'new';
    byRule[v.rule] = { ...slot, [key]: slot[key] + 1 };
  }
  const fresh = violations.filter((v) => !v.baseline);
  const unclassified = scanned.filter((i) => i.layer === 'unclassified').length;
  return {
    files: scanned.length,
    classified: scanned.length - unclassified,
    unclassified,
    byRule: sortKeys(byRule),
    newErrors: fresh.filter((v) => v.severity === 'error').length,
    newWarnings: fresh.filter((v) => v.severity === 'warn').length,
  };
}

// 기능 모듈 사이 순환. import type은 실행 시점 의존이 아니라서 뺀다
function findModuleCycles(project, onlyFiles) {
  const graph = new Map();
  for (const info of project.files.values()) {
    if (!info.moduleDir) continue;
    if (!graph.has(info.moduleDir)) graph.set(info.moduleDir, new Set());
    for (const ref of info.refs) {
      if (ref.target.kind !== 'file' || ref.typeOnly) continue;
      const to = project.files.get(ref.target.file).moduleDir;
      if (to && to !== info.moduleDir) graph.get(info.moduleDir).add(to);
    }
  }
  const touched = onlyFiles === null ? null : new Set([...onlyFiles].map((f) => project.files.get(f)?.moduleDir).filter(Boolean));
  return stronglyConnected(graph)
    .filter((c) => c.length > 1)
    .map((c) => [...c].sort(compareStrings))
    .filter((c) => touched === null || c.some((m) => touched.has(m)))
    .sort((a, b) => compareStrings(a.join(','), b.join(',')));
}

// Tarjan 알고리즘: 서로 도달 가능한 노드 묶음(강한 연결 요소)을 찾는다
function stronglyConnected(graph) {
  let counter = 0;
  const index = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const result = [];
  const visit = (v) => {
    index.set(v, counter);
    low.set(v, counter);
    counter += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), index.get(w)));
      }
    }
    if (low.get(v) === index.get(v)) {
      const component = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      result.push(component);
    }
  };
  for (const v of graph.keys()) if (!index.has(v)) visit(v);
  return result;
}
```

`lib/extract.mjs`에 한 줄 추가:

```js
export { runArchScan } from './arch-scan.mjs';
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test test/arch-scan.test.mjs`
Expected: PASS — `# pass 8`, `# fail 0`

만약 fixture 줄 수 가정(`list` 17줄, `orders.service.ts` 34줄)이 실제와 다르면 fixture를 고치지 말고 `wc -l`과 해당 파일을 확인한 뒤, 가정이 틀린 테스트 숫자만 실측값으로 바로잡는다. 위반 목록 자체가 다르면 구현을 고친다.

- [ ] **Step 5: 전체 테스트 확인 후 커밋**

Run: `npm test`
Expected: PASS — `# fail 0`

```bash
git add lib/arch-rules.mjs lib/arch-scan.mjs lib/extract.mjs test/arch-scan.test.mjs
git commit -m "feat: 계층 규칙 위반과 모듈 순환을 검사하는 arch-scan 로직을 추가한다" -m 'Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>'
```

---

### Task 8: 변경 파일 검사와 arch-scan 스킬

**Files:**
- Create: `lib/git.mjs`, `skills/arch-scan/scripts/arch-scan.mjs`, `skills/arch-scan/SKILL.md`
- Modify: `lib/extract.mjs` (재수출 1줄 추가)
- Test: `test/git-cli.test.mjs`

**Interfaces:**
- Consumes: `loadProject` (Task 5), `runArchScan` (Task 7), `runCli` (Task 6), `compareStrings` (Task 1)
- Produces:
  - `changedFiles(projectRoot, base = 'HEAD'): string[]` — 기준 ref 대비 변경 파일 + 추적 안 되는 새 파일. `projectRoot` 기준 `/` 경로, 정렬. 한글 경로를 이스케이프 없이 받으려고 `-z`를 쓴다
  - CLI: `arch-scan.mjs [--all | --changed] [--base <ref>] [--root] [--config] [--out]` — 기본은 `--changed`. 종료 코드 0/1/2

- [ ] **Step 1: 실패하는 테스트 작성** — `test/git-cli.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changedFiles } from '../lib/git.mjs';
import { FIXTURE } from './helpers.mjs';

const SCRIPT = fileURLToPath(new URL('../skills/arch-scan/scripts/arch-scan.mjs', import.meta.url));
const ORDERS = 'src/modules/orders';

// fixture를 임시 폴더에 복사해 독립된 git 저장소로 만든다
function gitCopy() {
  const dir = mkdtempSync(join(tmpdir(), 'cc-git-'));
  cpSync(FIXTURE, dir, { recursive: true });
  const git = (...args) => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: dir, stdio: 'pipe' });
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'init');
  return dir;
}

const runScan = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });

test('수정한 파일과 새 파일을 변경 목록으로 돌려준다', () => {
  const dir = gitCopy();
  appendFileSync(join(dir, `${ORDERS}/orders.controller.ts`), '\n// 변경\n');
  writeFileSync(join(dir, `${ORDERS}/new-file.ts`), 'export const x = 1;\n');
  assert.deepEqual(changedFiles(dir), [`${ORDERS}/new-file.ts`, `${ORDERS}/orders.controller.ts`]);
});

test('변경이 없으면 빈 목록을 돌려준다', () => {
  assert.deepEqual(changedFiles(gitCopy()), []);
});

test('CLI --all은 전체를 검사하고 신규 error가 있으면 종료 코드 1을 돌려준다', () => {
  const r = runScan(['--all', '--root', FIXTURE]);
  assert.equal(r.status, 1, r.stderr);
  const report = JSON.parse(r.stdout);
  assert.equal(report.mode, 'all');
  assert.equal(report.summary.newErrors, 6);
});

test('CLI 기본 모드는 변경 파일만 검사한다', () => {
  const dir = gitCopy();
  appendFileSync(join(dir, `${ORDERS}/legacy-orders.service.ts`), '\n// 변경\n');
  const r = runScan(['--root', dir]);
  assert.equal(r.status, 1, r.stderr);
  const report = JSON.parse(r.stdout);
  assert.equal(report.mode, 'changed');
  assert.deepEqual(report.violations.map((v) => v.rule), ['CA-DEP-02', 'CA-EXT-01', 'CA-EXT-02']);
});

test('CLI는 변경 파일에 위반이 없으면 종료 코드 0을 돌려준다', () => {
  const dir = gitCopy();
  appendFileSync(join(dir, 'src/utils/misc-helper.ts'), '\n// 변경\n');
  const r = runScan(['--root', dir]);
  assert.equal(r.status, 0, r.stdout);
  assert.equal(JSON.parse(r.stdout).summary.files, 1);
});

test('CLI는 git 저장소가 아니면 종료 코드 2와 오류를 돌려준다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cc-nogit-'));
  cpSync(FIXTURE, dir, { recursive: true });
  const r = runScan(['--root', dir]);
  assert.equal(r.status, 2);
  assert.match(JSON.parse(r.stdout).error, /git/);
});
```

(임시 폴더는 OS 임시 디렉터리 안이라 상위에 git 저장소가 없다. 마지막 테스트는 그 전제에 의존한다)

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test test/git-cli.test.mjs`
Expected: FAIL — `Cannot find module '.../lib/git.mjs'`

- [ ] **Step 3: 구현** — `lib/git.mjs`

```js
// 기준 ref 대비 변경된 파일 목록. -z로 받아 한글 등 비ASCII 경로가 이스케이프되지 않게 한다.

import { execFileSync } from 'node:child_process';
import { compareStrings } from './sort.mjs';

export function changedFiles(projectRoot, base = 'HEAD') {
  const git = (args) => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const diff = git(['diff', '--name-only', '--relative', '-z', base, '--']);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']);
  const all = `${diff}\0${untracked}`.split('\0').filter(Boolean);
  return [...new Set(all)].sort(compareStrings);
}
```

`skills/arch-scan/scripts/arch-scan.mjs`:

```js
#!/usr/bin/env node
// 설치본은 같은 폴더의 lib/를, 원본 저장소에서는 저장소 루트의 lib/를 쓴다.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const installed = join(here, 'lib', 'extract.mjs');
const libEntry = existsSync(installed) ? installed : join(here, '..', '..', '..', 'lib', 'extract.mjs');
const { loadProject, runArchScan, changedFiles, runCli } = await import(pathToFileURL(libEntry).href);

runCli(({ values, projectRoot }) => {
  const project = loadProject({ projectRoot, configPath: values.config });
  const onlyFiles = values.all ? null : new Set(changedFiles(projectRoot, values.base ?? 'HEAD'));
  const result = runArchScan(project, { onlyFiles });
  return { result, exitCode: result.summary.newErrors > 0 ? 1 : 0 };
}, {
  options: { all: { type: 'boolean' }, changed: { type: 'boolean' }, base: { type: 'string' } },
});
```

`lib/extract.mjs`에 한 줄 추가:

```js
export { changedFiles } from './git.mjs';
```

- [ ] **Step 4: SKILL.md 작성** — `skills/arch-scan/SKILL.md`

````markdown
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

- `--base <ref>`: 변경 기준(기본 `HEAD`). 브랜치 전체 변경은 `--base main`
- `--config <경로>`: `.claude/arch.json`이 아닌 설정 파일
- `--out <파일>`: 결과를 파일로 저장(전체 검사 결과가 클 때)
- 종료 코드: 0 신규 error 없음 / 1 신규 error 있음 / 2 스크립트 오류

## 절차

1. 실행한다. 코드를 방금 고쳤으면 기본 모드, 구조 점검 요청이면 `--all`.
2. 아래 형식으로 보고한다. 규칙 설명은 `~/.claude/rules/<rules[ID].doc>`의 해당 ID 절을 근거로 한다.
3. **코드는 고치지 않는다.** 사용자가 요청할 때만 고친다.
4. `baseline`에 넣을 후보는 제안만 한다. `.claude/arch.json` 수정은 사용자가 승인한 뒤에 한다.

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

`.claude/arch.json`의 `baseline`에 `{ "rule": "CA-CTRL-02", "file": "src/a.controller.ts", "reason": "이유" }`로 적는다.
순환(`CA-DEP-02`)은 `file`에 결과의 `cycle:<모듈>,<모듈>` 값을 그대로 적는다.
````

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test test/git-cli.test.mjs`
Expected: PASS — `# pass 6`, `# fail 0`

- [ ] **Step 6: 전체 테스트 확인 후 커밋**

Run: `npm test`
Expected: PASS — `# fail 0`

```bash
git add lib/git.mjs lib/extract.mjs skills/arch-scan test/git-cli.test.mjs
git commit -m "feat: 변경 파일 기준으로 규칙 위반을 검사하는 arch-scan 스킬을 추가한다" -m 'Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>'
```

---

### Task 9: 규칙 문서

**Files:**
- Create: `rules/clean-arch/common/00-overview.md`, `dependency.md`, `pure-logic.md`, `boundaries.md`, `optional.md`
- Create: `rules/clean-arch/typescript/nestjs-layers.md`, `nestjs-ports.md`, `typeorm.md`
- Test: `test/rules-docs.test.mjs`

**Interfaces:**
- Consumes: `RULES` (Task 7) — 각 ID의 `doc` 경로에 `### <ID> ` 제목이 있어야 한다
- Produces: 설치 대상 규칙 문서. 규칙 제목 형식은 `### CA-XXX-NN 한 줄 규칙`

`common/` 파일의 frontmatter는 모두 아래와 같다(이하 "공통 frontmatter"):

```yaml
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
```

`typescript/` 파일의 frontmatter는 모두 아래와 같다(이하 "TS frontmatter"):

```yaml
---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---
```

- [ ] **Step 1: 실패하는 테스트 작성** — `test/rules-docs.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../lib/arch-rules.mjs';

const RULES_DIR = fileURLToPath(new URL('../rules', import.meta.url));
const EXPECTED = [
  'clean-arch/common/00-overview.md',
  'clean-arch/common/boundaries.md',
  'clean-arch/common/dependency.md',
  'clean-arch/common/optional.md',
  'clean-arch/common/pure-logic.md',
  'clean-arch/typescript/nestjs-layers.md',
  'clean-arch/typescript/nestjs-ports.md',
  'clean-arch/typescript/typeorm.md',
];

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const docs = () => walk(RULES_DIR).map((abs) => ({ rel: relative(RULES_DIR, abs).split(sep).join('/'), text: readFileSync(abs, 'utf8') }));

test('규칙 문서 8개가 정해진 위치에 있다', () => {
  assert.deepEqual(docs().map((d) => d.rel).sort(), EXPECTED);
});

test('모든 규칙 문서는 paths frontmatter로 시작한다', () => {
  for (const { rel, text } of docs()) assert.match(text, /^---\r?\npaths:\r?\n(?: {2}- ".+"\r?\n)+---\r?\n/, rel);
});

test('모든 규칙 문서는 100줄 이내다', () => {
  for (const { rel, text } of docs()) assert.ok(text.split('\n').length <= 100, `${rel}: ${text.split('\n').length}줄`);
});

test('arch-scan 규칙 ID마다 해당 문서에 제목이 있다', () => {
  for (const [id, meta] of Object.entries(RULES)) {
    const text = readFileSync(join(RULES_DIR, meta.doc), 'utf8');
    assert.match(text, new RegExp(`^### ${id} `, 'm'), `${meta.doc}에 ${id} 제목 없음`);
  }
});

test('규칙 ID 제목은 전체 문서에서 중복되지 않는다', () => {
  const ids = docs().flatMap(({ text }) => [...text.matchAll(/^### (CA-[A-Z]+-\d{2}) /gm)].map((m) => m[1]));
  assert.equal(new Set(ids).size, ids.length, ids.join(', '));
  assert.ok(ids.includes('CA-OPT-03'));
});

test('원문자 같은 장식 문자를 쓰지 않는다', () => {
  for (const { rel, text } of docs()) assert.doesNotMatch(text, /[①-⓿❶-➓㉠-㉿]/, rel);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test test/rules-docs.test.mjs`
Expected: FAIL — `ENOENT: no such file or directory, scandir '.../rules'`

- [ ] **Step 3: `common/00-overview.md` 작성** (공통 frontmatter + 아래 본문)

```markdown
# 클린 아키텍처 규칙 — 개요

업무 규칙이 프레임워크·DB·외부 API에 끌려다니지 않게 하는 코드 작성 기준이다.
새로 작성하거나 수정하는 코드에 적용한다.

## 핵심 한 줄

import는 바깥(프레임워크·어댑터)에서 안쪽(유스케이스·도메인)으로만 향한다.
판단 기준은 폴더 이름이 아니라 **import 방향**이다. `domain/` 폴더 안에서 ORM을 import하면 위반이다.

## 필수와 선택

| 구분 | 원칙 | 문서 |
| --- | --- | --- |
| 필수 | 의존 방향 | `dependency.md` |
| 필수 | 순수 로직 분리 | `pure-logic.md` |
| 필수 | 외부 시스템 격리 | `boundaries.md` |
| 필수 | 얇은 컨트롤러 | `boundaries.md` |
| 선택 | 도메인·ORM 분리, 유스케이스 클래스, repository port | `optional.md` |

- 필수 원칙은 항상 지킨다.
- 선택 원칙은 `optional.md`의 판단 기준을 충족할 때만 적용한다. 기준 없이 계층을 늘리지 않는다.

## 다른 규칙과의 우선순위

- 데이터 접근 계층(repository를 둘지)은 이 규칙이 `rules/ecc/common/patterns.md`의 Repository Pattern 권고보다 우선한다. repository는 `CA-OPT-03` 기준을 충족할 때만 만든다.
- 불변성, 파일 크기, 테스트 커버리지 같은 나머지 항목은 기존 규칙을 따른다.

## 프로젝트 설정

- 파일이 어느 계층인지는 프로젝트의 `.claude/arch.json`을 따른다. 없으면 언어별 규칙(예: `typescript/nestjs-layers.md`)의 기본 대응을 쓴다.
- `arch.json`의 `baseline`은 이미 알고 있는 위반 목록이다. 허용 목록이 아니다. 기존 위반을 언제 고칠지는 프로젝트 방침을 따른다.

## 도구

- `context-pack` 스킬: 모듈 구조를 JSON으로 요약한다. 모듈을 수정하기 전에 먼저 실행한다.
- `arch-scan` 스킬: 이 규칙의 위반을 검사하고 규칙 ID로 보고한다.

## 규칙 ID 읽는 법

- `CA-DEP` 의존 방향, `CA-PURE` 순수 로직, `CA-EXT` 외부 격리, `CA-CTRL` 컨트롤러, `CA-OPT` 선택 원칙
- 각 규칙의 **판정** 줄: "스크립트"는 arch-scan이 검사한다. "AI"는 코드를 쓰거나 리뷰할 때 AI가 판단한다.
```

- [ ] **Step 4: `common/dependency.md` 작성** (공통 frontmatter + 아래 본문)

````markdown
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
````

- [ ] **Step 5: `common/pure-logic.md` 작성** (공통 frontmatter + 아래 본문)

```markdown
# 순수 로직 분리

순수 로직은 같은 입력에 항상 같은 결과를 돌려주고, 바깥 상태(DB, 시계, 네트워크)를 건드리지 않는 코드다.
도메인 계층은 순수 로직만 담는다.

### CA-PURE-01 도메인은 외부 패키지를 import하지 않는다

- 규칙: domain 파일은 프레임워크(`@nestjs/*`, `typeorm` 등)를 포함한 외부 패키지를 import하지 않는다.
- 예외: 계산 전용 라이브러리처럼 순수한 패키지는 `arch.json`의 `domainAllowedPackages`에 등록한 뒤 쓴다.
- 이유: 프레임워크를 import한 순간 도메인을 테스트하거나 옮길 때 프레임워크가 따라온다.
- 판정: 스크립트

### CA-PURE-02 도메인은 엔티티를 import type으로만 참조한다

- 규칙: domain 파일이 ORM 엔티티를 쓸 때는 `import type { Order } from ...`로 가져온다. 일반 import는 금지한다.
- 이유: `import type`은 컴파일 후 사라져 실행 시점에 ORM을 끌어오지 않는다. 엔티티마다 도메인 타입을 따로 만드는 일은 선택 원칙(`CA-OPT-01`)이다.
- 판정: 스크립트

### CA-PURE-03 시간과 랜덤은 인자로 받는다

- 규칙: domain 파일에서 `new Date()`, `Date.now()`, `Math.random()`을 직접 호출하지 않는다. 호출하는 쪽이 값을 넘긴다.
- 이유: 현재 시각이나 난수에 의존하면 같은 입력에 결과가 달라져 테스트가 흔들린다.
- 나쁜 예: `isExpired(order) { return Date.now() - order.createdAt > DAY }`
- 좋은 예: `isExpired(order, nowMs) { return nowMs - order.createdAt > DAY }`
- 판정: 스크립트(warn). 인자 있는 `new Date(value)`는 변환이라 허용한다.

### CA-PURE-04 분기·계산·판정은 순수 함수로 뺀다

- 규칙: 다음 중 하나에 해당하면 서비스 안에 두지 말고 domain 파일의 함수로 뺀다.
  1. 조건 3개 이상을 조합한 판정
  2. 같은 계산이 2곳 이상에 있음
  3. 테스트하려면 DB 가짜 객체가 필요한 판정
- 서비스 메서드는 "조회 → 순수 함수 호출 → 저장" 순서로 읽혀야 한다.
- 이유: 판정을 순수 함수로 빼면 가짜 객체 없이 입력·출력만으로 테스트할 수 있고, 규칙이 한 곳에 모인다.
- 판정: AI. arch-scan의 `reviewHints`(큰 서비스 목록)가 검토 후보를 준다.

### CA-PURE-05 순수 로직 테스트는 가짜 객체 없이 입력과 결과만 비교한다

- 규칙: domain 함수의 테스트에 mock·stub을 쓰지 않는다. 쓰고 싶어진다면 그 함수가 순수하지 않다는 신호다.
- 판정: AI
```

- [ ] **Step 6: `common/boundaries.md` 작성** (공통 frontmatter + 아래 본문)

```markdown
# 경계: 외부 시스템과 컨트롤러

경계는 우리 코드와 바깥 세계(HTTP 요청, 다른 시스템, DB)가 만나는 곳이다.
경계를 얇고 명확하게 두면 바깥이 바뀌어도 안쪽 코드가 흔들리지 않는다.

### CA-EXT-01 외부 SDK는 지정한 어댑터 파일에서만 import한다

- 규칙: 외부 시스템 SDK(결제, 푸시, 다른 사내 시스템 클라이언트 등)는 `arch.json`의 `externals`에 등록하고, 등록한 어댑터 파일에서만 import한다.
- 이유: SDK가 여러 파일에 퍼지면 교체·버전업·장애 대응 때 수정 범위를 알 수 없다.
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
```

- [ ] **Step 7: `common/optional.md` 작성** (공통 frontmatter + 아래 본문)

```markdown
# 선택 원칙과 도입 기준

아래 원칙은 효과가 있지만 파일과 변환 코드를 늘린다. **판단 기준을 충족할 때만** 적용하고, 적용했다면 이유를 커밋 메시지에 남긴다.

### CA-OPT-01 도메인 모델과 ORM 엔티티를 분리한다

- 기본값: 분리하지 않는다. 도메인은 엔티티를 `import type`으로 참조한다(`CA-PURE-02`).
- 적용 기준(하나 이상):
  1. 엔티티에 항상 지켜야 할 조건(불변식)이 3개 이상이다
  2. 저장 구조와 업무 개념이 크게 다르다(예: 한 업무 개념이 테이블 3개에 나뉨)
- 적용 방법: 도메인 타입과 매퍼(엔티티↔도메인 변환 함수)를 만들고, 매퍼는 어댑터 계층에 둔다.

### CA-OPT-02 기능 하나당 유스케이스 클래스를 둔다

- 기본값: 서비스 클래스 하나에 관련 기능을 모은다.
- 적용 기준(하나 이상):
  1. 한 기능이 port 2개 이상을 조합하고 트랜잭션을 가진다
  2. 서비스 파일이 500줄을 넘는다(arch-scan `reviewHints`에 나타남)
- 적용 방법: `approve-request.usecase.ts`처럼 기능 이름으로 파일을 만들고 public 메서드는 `execute` 하나만 둔다. 파일은 `arch.json`의 usecase 계층 패턴에 추가한다.

### CA-OPT-03 repository port를 둔다

- 기본값: 유스케이스가 ORM의 기본 repository(`Repository<Entity>`)를 직접 쓴다.
- 적용 기준(하나 이상):
  1. 3개 이상 모듈이 같은 테이블을 조회한다
  2. 조회할 때 반드시 지켜야 할 규칙이 있다(개인정보 컬럼 차단, 코드 표기 변환, 소프트 삭제 필터 등)
- 적용 방법: `customer.port.ts`에 의미 있는 메서드(`findActiveById`)로 인터페이스를 정의하고, 구현은 `*.repository.ts`(어댑터)에 둔다. 트랜잭션용 메서드는 `EntityManager`를 인자로 받는다.
- 이유: 규칙을 한 곳에서 강제하고, 테스트 가짜가 ORM 쿼리 모양이 아니라 의미 있는 메서드 하나로 줄어든다.
```

- [ ] **Step 8: `typescript/nestjs-layers.md` 작성** (TS frontmatter + 아래 본문)

```markdown
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
```

- [ ] **Step 9: `typescript/nestjs-ports.md` 작성** (TS frontmatter + 아래 본문)

````markdown
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
````

- [ ] **Step 10: `typescript/typeorm.md` 작성** (TS frontmatter + 아래 본문)

````markdown
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
````

- [ ] **Step 11: 테스트 통과 확인**

Run: `node --test test/rules-docs.test.mjs`
Expected: PASS — `# pass 6`, `# fail 0`

- [ ] **Step 12: 전체 테스트 확인 후 커밋**

Run: `npm test`
Expected: PASS — `# fail 0`

```bash
git add rules test/rules-docs.test.mjs
git commit -m "docs: 클린 아키텍처 규칙 문서를 추가한다" -m 'Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>'
```

---

### Task 10: 설치 스크립트와 README

**Files:**
- Create: `install.mjs`, `README.md`
- Test: `test/install.test.mjs`

**Interfaces:**
- Consumes: 저장소의 `rules/clean-arch/`, `skills/*`, `lib/` (Task 1~9)
- Produces:
  - `MARKER = '.installed-by-claude-conventions'`
  - `install({ repoRoot, target }): string[]` — 설치한 폴더 절대 경로 3개. 표식 없는 같은 이름 폴더가 하나라도 있으면 **아무것도 복사하지 않고** 예외
  - CLI: `node install.mjs [--target <dir>]` (기본 `~/.claude`)

- [ ] **Step 1: 실패하는 테스트 작성** — `test/install.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MARKER, install } from '../install.mjs';
import { FIXTURE, REPO } from './helpers.mjs';

const tmp = () => mkdtempSync(join(tmpdir(), 'cc-install-'));

test('규칙과 스킬을 설치하고 스킬마다 lib를 복사한다', () => {
  const target = tmp();
  const dests = install({ repoRoot: REPO, target });
  assert.equal(dests.length, 3);
  assert.ok(existsSync(join(target, 'rules/clean-arch/common/dependency.md')));
  assert.ok(existsSync(join(target, 'skills/context-pack/SKILL.md')));
  assert.ok(existsSync(join(target, 'skills/context-pack/scripts/lib/extract.mjs')));
  assert.ok(existsSync(join(target, 'skills/arch-scan/scripts/lib/extract.mjs')));
  for (const d of dests) assert.ok(existsSync(join(d, MARKER)));
});

test('두 번 설치해도 결과가 같다', () => {
  const target = tmp();
  install({ repoRoot: REPO, target });
  const before = readdirSync(join(target, 'skills/arch-scan/scripts/lib')).sort();
  install({ repoRoot: REPO, target });
  assert.deepEqual(readdirSync(join(target, 'skills/arch-scan/scripts/lib')).sort(), before);
  assert.equal(readFileSync(join(target, 'skills/arch-scan', MARKER), 'utf8'), 'installed by claude-conventions\n');
});

test('표식 없는 같은 이름 폴더가 있으면 아무것도 설치하지 않고 멈춘다', () => {
  const target = tmp();
  mkdirSync(join(target, 'skills/arch-scan'), { recursive: true });
  assert.throws(() => install({ repoRoot: REPO, target }), /표식 없는 기존 폴더/);
  assert.equal(existsSync(join(target, 'rules/clean-arch')), false);
  assert.equal(existsSync(join(target, 'skills/context-pack')), false);
});

test('설치된 스크립트는 설치 폴더의 lib로 실행된다', () => {
  const target = tmp();
  install({ repoRoot: REPO, target });
  const script = join(target, 'skills/context-pack/scripts/context-pack.mjs');
  const r = spawnSync(process.execPath, [script, 'orders', '--root', FIXTURE], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).imports, ['payments']);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --test test/install.test.mjs`
Expected: FAIL — `Cannot find module '.../install.mjs'`

- [ ] **Step 3: 구현** — `install.mjs`

```js
#!/usr/bin/env node
// 규칙 문서와 스킬을 Claude Code 전역 위치(~/.claude)로 복사한다.
// 이 스크립트가 만든 폴더(표식 파일이 있는 폴더)만 덮어쓴다.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const MARKER = '.installed-by-claude-conventions';

const ITEMS = [
  { src: 'rules/clean-arch', dest: 'rules/clean-arch', withLib: false },
  { src: 'skills/context-pack', dest: 'skills/context-pack', withLib: true },
  { src: 'skills/arch-scan', dest: 'skills/arch-scan', withLib: true },
];

export function install({ repoRoot, target }) {
  const blocked = ITEMS.map((item) => join(target, item.dest)).filter((d) => existsSync(d) && !existsSync(join(d, MARKER)));
  if (blocked.length > 0) throw new Error(`표식 없는 기존 폴더가 있어 설치를 중단합니다: ${blocked.join(', ')}`);
  return ITEMS.map((item) => {
    const dest = join(target, item.dest);
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(join(repoRoot, item.src), dest, { recursive: true });
    if (item.withLib) cpSync(join(repoRoot, 'lib'), join(dest, 'scripts', 'lib'), { recursive: true });
    writeFileSync(join(dest, MARKER), 'installed by claude-conventions\n');
    return dest;
  });
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  const { values } = parseArgs({ options: { target: { type: 'string' } } });
  const target = resolve(values.target ?? join(homedir(), '.claude'));
  try {
    const dests = install({ repoRoot: dirname(fileURLToPath(import.meta.url)), target });
    console.log(`설치 완료:\n${dests.join('\n')}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
```

`README.md`:

````markdown
# claude-conventions

여러 프로젝트에서 재사용하는 Claude Code용 클린 아키텍처 규칙과 스킬.

- **Rules** (`rules/clean-arch/`): AI가 코드를 쓸 때 따르는 작성 규칙. 규칙 ID `CA-*`
- **Skills** (`skills/`): 스크립트가 코드를 먼저 읽어 필요한 메타데이터만 JSON으로 요약한다
  - `context-pack`: 모듈 구조 요약(라우트, 의존, 엔티티 컬럼, 서비스 메서드)
  - `arch-scan`: 규칙 위반 검사(변경 파일 또는 전체)

스크립트는 Node 22 이상만 있으면 되고 npm 의존성이 없다.

## 설치

```bash
node install.mjs                    # ~/.claude 에 설치
node install.mjs --target <폴더>    # 다른 위치에 설치(검증용)
```

- 설치는 `~/.claude/rules/clean-arch/`, `~/.claude/skills/context-pack/`, `~/.claude/skills/arch-scan/`에 복사한다.
- 이 스크립트가 만든 폴더(`.installed-by-claude-conventions` 표식 있음)만 덮어쓴다. 같은 이름의 다른 폴더가 있으면 멈춘다.
- 규칙이나 스크립트를 고친 뒤에는 다시 설치해야 반영된다.

## 프로젝트 설정

`templates/arch.json`을 프로젝트의 `.claude/arch.json`으로 복사해 기본값과 다른 부분만 남긴다. 없으면 NestJS 기본값으로 동작한다.

## 개발

```bash
npm test
```

설계: `docs/specs/2026-09-29-clean-arch-rules-skills-design.md`
````

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test test/install.test.mjs`
Expected: PASS — `# pass 4`, `# fail 0`

- [ ] **Step 5: 전체 테스트 확인 후 커밋**

Run: `npm test`
Expected: PASS — `# fail 0`

```bash
git add install.mjs README.md test/install.test.mjs
git commit -m "feat: 규칙과 스킬을 ~/.claude로 복사하는 설치 스크립트를 추가한다" -m 'Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>'
```

---

### Task 11: 실제 프로젝트 실측 검증과 실제 설치

**Files:**
- 임시(저장소 밖): `$SCRATCH/validation-arch.json`, `$SCRATCH/count-controllers.mjs`, `$SCRATCH/measure.mjs`
- 검증 결과 메모는 저장소 밖에 비공개로 둔다(공개 저장소에 커밋하지 않는다)

**Interfaces:**
- Consumes: `lib/extract.mjs`의 `loadProject`, `buildContextPack`, `runArchScan` (Task 5~8), `install.mjs` (Task 10)
- Produces: 설계 9-2의 합격 기준 4개에 대한 대조 결과, `~/.claude`에 설치된 규칙·스킬

이 Task의 모든 명령에서 쓰는 경로(Git Bash). 값은 작업자가 채운다:

```bash
TARGET="<검증 대상 프로젝트 루트>"
SCRATCH="<로컬 임시 폴더>"
CC="<claude-conventions 저장소 루트>"
```

- [ ] **Step 1: 검증 전 대상 작업 트리 상태 기록**

Run: `git -C "$TARGET" status --short > "$SCRATCH/status-before.txt"; cat "$SCRATCH/status-before.txt"`
Expected: 작업 시작 전 상태 그대로. 이 값은 Step 6에서 비교한다

- [ ] **Step 2: 검증용 설정 작성** — `$SCRATCH/validation-arch.json` (대상 프로젝트의 폴더 구조에 맞춰 작성. 저장소에는 두지 않는다)

```jsonc
{
  "layers": [
    { "layer": "framework", "match": ["src/main.ts", "src/app.module.ts", "**/*.module.ts"] },
    { "layer": "adapter",   "match": ["**/*.controller.ts", "src/modules/payments/gateway/**"] },
    { "layer": "usecase",   "match": ["**/*.service.ts", "**/*.port.ts"] },
    { "layer": "domain",    "match": ["**/*.policy.ts"] },
    { "layer": "entity",    "match": ["src/entities/**"] }
  ],
  "externals": { "stripe": ["src/modules/payments/stripe-payment.adapter.ts"] }
}
```

- [ ] **Step 3: 스크립트 실행**

Run: `node "$CC/skills/context-pack/scripts/context-pack.mjs" <모듈이름> --root "$TARGET" --config "$SCRATCH/validation-arch.json" --out "$SCRATCH/pack.json"`
Run: `node "$CC/skills/arch-scan/scripts/arch-scan.mjs" --all --root "$TARGET" --config "$SCRATCH/validation-arch.json" --out "$SCRATCH/scan-all.json"`
Expected: 두 명령 모두 종료 코드 0(arch-scan은 1도 허용, 2면 실패)이고 출력 파일이 생성된다

- [ ] **Step 4: 합격 기준 4개를 수동 실측과 대조**

`$SCRATCH/count-controllers.mjs`는 `loadProject`로 `controllers` 필드를 합산해 전체 컨트롤러 수를 출력한다(`grep -rc "@Controller(" "$TARGET/src/modules" --include=*.ts`의 합계와 비교).

| 항목 | 스크립트 결과 | 수동 실측 |
| --- | --- | --- |
| 한 모듈의 엔티티 목록 | `pack.json`의 `entities` | 해당 모듈의 `forFeature([...])`와 엔티티 파일을 직접 확인 |
| 그 모듈의 Nest import 목록 | `pack.json`의 `imports` | 모듈 파일의 `imports: [...]`를 직접 확인 |
| 전체 `@Controller` 수 | `count-controllers.mjs` 출력 | `grep` 합계 |
| `CA-CTRL-02` 대상 파일 | `scan-all.json`에서 해당 규칙의 `file` 목록 | 컨트롤러 파일에서 repository·ORM 사용을 직접 확인 |

Expected: 4개 모두 일치. 불일치하면 Step 5로 간다

- [ ] **Step 5: 불일치가 있으면 원인을 고친다** (모두 일치하면 건너뛴다)

1. superpowers:systematic-debugging 스킬로 원인을 찾는다. 대상 프로젝트에서 불일치한 부분만 Read한다.
2. 원인이 된 코드 모양을 `test/fixtures/mini-nest/` 또는 해당 단위 테스트에 최소 재현으로 추가하고 실패를 확인한다. 대상 프로젝트의 실제 이름은 재현 코드에 쓰지 않는다.
3. `lib/`를 고쳐 통과시키고 `npm test` 전체를 통과시킨다.
4. Step 3~4를 다시 실행한다.
5. `git commit -m "fix: <원인 요약>"` (커밋 형식은 Global Constraints를 따른다)

- [ ] **Step 6: 컨텍스트 절감 측정과 대상 프로젝트 무변경 확인**

`$SCRATCH/measure.mjs`로 여러 모듈에 대해 context-pack JSON 바이트 ÷ 요약 대상 원본 파일 합계 바이트를 계산한다(`buildContextPack` 결과의 `files`로 원본 파일을 찾는다).

Run: `git -C "$TARGET" status --short | diff - "$SCRATCH/status-before.txt" && echo UNCHANGED`
Expected: `UNCHANGED`

- [ ] **Step 7: 검증 결과 메모 작성 (비공개)**

`$SCRATCH/validation-note.md`에 실행 일시, 대상 브랜치, Step 4 대조표와 일치 여부, Step 6 절감 비율, 발견하고 고친 문제를 적는다. 이 메모는 대상 프로젝트의 구체적 이름과 수치를 담으므로 공개 저장소에 커밋하지 않는다.

- [ ] **Step 8: 실제 설치**

Run: `ls ~/.claude/skills ~/.claude/rules` (설치 전 확인: `context-pack`, `arch-scan`, `clean-arch`가 없어야 한다. 있으면 설치 스크립트가 멈추므로 그 폴더의 출처를 사용자에게 알리고 중단한다)
Run: `cd "$CC" && node install.mjs`
Expected: `설치 완료:` 뒤에 `.claude\rules\clean-arch`, `.claude\skills\context-pack`, `.claude\skills\arch-scan` 세 줄

- [ ] **Step 9: 설치본 스모크 실행**

Run: `node ~/.claude/skills/context-pack/scripts/context-pack.mjs <모듈이름> --root "$TARGET" --config "$SCRATCH/validation-arch.json" | head -c 300`
Expected: `{"target":"<모듈이름>",...` 로 시작하는 한 줄 JSON, 종료 코드 0

Run: `node ~/.claude/skills/arch-scan/scripts/arch-scan.mjs --root "$TARGET" --config "$SCRATCH/validation-arch.json" --out "$SCRATCH/scan-changed.json"; echo "exit=$?"; head -c 300 "$SCRATCH/scan-changed.json"`
Expected: `exit=0` 또는 `exit=1`(2면 실패), 파일 내용은 `{"mode":"changed",...`로 시작
