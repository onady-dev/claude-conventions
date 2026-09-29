import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classify, moduleDirOf, moduleLabel, countLines, loadProject } from '../lib/project.mjs';
import { packageName, resolveImport } from '../lib/resolve.mjs';
import { listSpecFiles } from '../lib/files.mjs';
import { DEFAULT_CONFIG } from '../lib/config.mjs';
import { loadFixture, FIXTURE } from './helpers.mjs';

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

test('줄 수는 끝 줄바꿈을 세지 않는다', () => {
  assert.equal(countLines(''), 0);
  assert.equal(countLines('a'), 1);
  assert.equal(countLines('a\n'), 1);
  assert.equal(countLines('a\nb\n'), 2);
  assert.equal(countLines('a\r\nb\r\n'), 2);
});

test('해석할 수 없는 줄이 있어도 로드를 멈추지 않고 unparsed에 싣는다', () => {
  const info = loadFixture().files.get('src/modules/orders/broken.ts');
  assert.deepEqual(info.parsed.unparsed, [{ line: 1, text: 'import something' }]);
  assert.equal(info.layer, 'unclassified');
  assert.equal(info.moduleDir, 'orders');
  assert.equal(info.lines, 2);
});

test('모듈 폴더 아래 spec 파일 목록을 돌려준다', () => {
  assert.deepEqual(listSpecFiles(FIXTURE, 'src/modules/orders'), ['src/modules/orders/orders.service.spec.ts']);
  assert.deepEqual(listSpecFiles(FIXTURE, 'src/modules/none'), []);
});

test('역방향 의존 항목에 type 여부와 줄 번호를 싣는다', () => {
  const edges = loadFixture().inEdges.get('src/entities/order.entity.ts');
  const pricing = edges.find((e) => e.from === 'src/modules/orders/order-pricing.policy.ts');
  assert.deepEqual(pricing, { from: 'src/modules/orders/order-pricing.policy.ts', typeOnly: true, line: 1 });
});
test('UTF-8 BOM이 있어도 첫 줄 import를 읽는다', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-bom-'));
  mkdirSync(join(root, 'src/modules/x'), { recursive: true });
  writeFileSync(join(root, 'src/modules/x/a.policy.ts'), '﻿import { Repository } from \'typeorm\';\nexport const f = 1;\n');
  const info = loadProject({ projectRoot: root }).files.get('src/modules/x/a.policy.ts');
  assert.deepEqual(info.refs.map((r) => r.spec), ['typeorm']);
});
