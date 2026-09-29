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
