import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RULES, layerRule } from '../lib/arch-rules.mjs';
import { runArchScan } from '../lib/arch-scan.mjs';
import { loadProject } from '../lib/project.mjs';
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

function tempProject(baseline) {
  const root = mkdtempSync(join(tmpdir(), 'cc-baseline-'));
  mkdirSync(join(root, 'src/modules/x'), { recursive: true });
  mkdirSync(join(root, '.claude'));
  writeFileSync(join(root, 'src/modules/x/a.policy.ts'), "import { A } from '@nestjs/common';\nimport { B } from 'typeorm';\nexport const f = () => 1;\n");
  writeFileSync(join(root, '.claude/arch.json'), JSON.stringify({ baseline }));
  return loadProject({ projectRoot: root });
}

test('baseline count를 넘는 같은 규칙 위반은 신규로 본다', () => {
  const report = runArchScan(tempProject([{ rule: 'CA-PURE-01', file: 'src/modules/x/a.policy.ts', count: 1 }]));
  assert.deepEqual(report.violations.map((v) => [v.rule, v.line, v.baseline]), [['CA-PURE-01', 1, true], ['CA-PURE-01', 2, false]]);
  assert.equal(report.summary.newErrors, 1);
  assert.deepEqual(report.summary.byRule['CA-PURE-01'], { new: 1, baseline: 1 });
});

test('baseline에 count가 없으면 그 파일의 같은 규칙 위반을 모두 기존으로 본다', () => {
  const report = runArchScan(tempProject([{ rule: 'CA-PURE-01', file: 'src/modules/x/a.policy.ts' }]));
  assert.deepEqual(report.violations.map((v) => v.baseline), [true, true]);
  assert.equal(report.summary.newErrors, 0);
});
