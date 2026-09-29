import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContextPack } from '../lib/context-pack.mjs';
import { loadProject } from '../lib/project.mjs';
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
  assert.equal(pack.overLimit, false);
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
  assert.equal(pack.overLimit, true);
  assert.deepEqual(pack.services.OrdersService, ['getOne', 'create']);
  assert.equal(pack.routes[0].decorators, undefined);
  assert.equal(pack.controllers.length, 2);
});

test('경로를 문자열로 읽지 못한 데코레이터는 unparsed로 알린다', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-pack-'));
  mkdirSync(join(root, 'src/modules/items'), { recursive: true });
  writeFileSync(join(root, 'src/modules/items/items.controller.ts'), [
    "import { Controller, Get } from '@nestjs/common';",
    '',
    "@Controller({ path: 'items', version: '1' })",
    'export class ItemsController {',
    '  @Get(ITEM_PATHS)',
    '  list() {',
    '    return [];',
    '  }',
    '}',
    '',
  ].join('\n'));
  const pack = buildContextPack(loadProject({ projectRoot: root }), 'items');
  assert.deepEqual(pack.routes.map((r) => [r.method, r.path]), [['GET', '']]);
  assert.deepEqual(pack.unparsed.map((u) => [u.line, u.text]), [
    [4, "@Controller 경로를 문자열로 읽지 못함: { path: 'items', version: '1' }"],
    [6, '@Get 경로를 문자열로 읽지 못함: ITEM_PATHS'],
  ]);
});

test('CLI는 공통 lib를 못 불러오면 JSON 오류와 종료 코드 2를 돌려준다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cc-script-'));
  const script = join(dir, 'context-pack.mjs');
  copyFileSync(SCRIPT, script);
  const r = spawnSync(process.execPath, [script, 'orders'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(JSON.parse(r.stdout).error, /공통 lib를 불러오지 못했습니다/);
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
