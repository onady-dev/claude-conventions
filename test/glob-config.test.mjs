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

test('externals가 null이면 오류다', () => {
  const root = tmp();
  writeArch(root, '{ "externals": null }');
  assert.throws(() => loadConfig({ projectRoot: root }), /externals는/);
});

test('externals 값이 배열이 아니면 오류다', () => {
  const root = tmp();
  writeArch(root, '{ "externals": { "stripe": "src/a.ts" } }');
  assert.throws(() => loadConfig({ projectRoot: root }), /externals는/);
});

test('root가 문자열이 아니면 오류다', () => {
  const root = tmp();
  writeArch(root, '{ "root": 5 }');
  assert.throws(() => loadConfig({ projectRoot: root }), /root는/);
});

test('root가 빈 문자열이면 오류다', () => {
  const root = tmp();
  writeArch(root, '{ "root": "" }');
  assert.throws(() => loadConfig({ projectRoot: root }), /root는/);
});

test('modulesDir이 문자열이 아니면 오류다', () => {
  const root = tmp();
  writeArch(root, '{ "modulesDir": null }');
  assert.throws(() => loadConfig({ projectRoot: root }), /modulesDir는/);
});

test('modulesDir이 빈 문자열이면 오류다', () => {
  const root = tmp();
  writeArch(root, '{ "modulesDir": "" }');
  assert.throws(() => loadConfig({ projectRoot: root }), /modulesDir는/);
});

test('limits가 객체가 아니면 오류다', () => {
  const root = tmp();
  writeArch(root, '{ "limits": "invalid" }');
  assert.throws(() => loadConfig({ projectRoot: root }), /limits는 객체여야 합니다/);
});

test('limits 값이 숫자가 아니면 오류다', () => {
  const root = tmp();
  writeArch(root, '{ "limits": { "controllerHandlerMaxLines": "15" } }');
  assert.throws(() => loadConfig({ projectRoot: root }), /limits.controllerHandlerMaxLines는 양수여야 합니다/);
});

test('limits 값이 음수면 오류다', () => {
  const root = tmp();
  writeArch(root, '{ "limits": { "controllerHandlerMaxLines": -5 } }');
  assert.throws(() => loadConfig({ projectRoot: root }), /limits.controllerHandlerMaxLines는 양수여야 합니다/);
});

test('알 수 없는 limits 항목은 오류다', () => {
  const root = tmp();
  writeArch(root, '{ "limits": { "maxLines": 3 } }');
  assert.throws(() => loadConfig({ projectRoot: root }), /알 수 없는 limits 항목 'maxLines'/);
});

test('baseline count가 양의 정수가 아니면 오류다', () => {
  const root = tmp();
  writeArch(root, '{ "baseline": [{ "rule": "CA-DEP-01", "file": "a.ts", "count": 0 }] }');
  assert.throws(() => loadConfig({ projectRoot: root }), /baseline의 count는 양의 정수/);
});
