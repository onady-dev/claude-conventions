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
test('--base는 분기 지점 기준으로 현재 브랜치의 변경만 돌려준다', () => {
  const dir = gitCopy();
  const git = (...args) => execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args], { cwd: dir, stdio: 'pipe' });
  git('branch', '-M', 'main');
  git('checkout', '-q', '-b', 'feat');
  git('checkout', '-q', 'main');
  appendFileSync(join(dir, `${ORDERS}/orders.controller.ts`), '\n// main만\n');
  git('commit', '-qam', 'main change');
  git('checkout', '-q', 'feat');
  appendFileSync(join(dir, 'src/utils/misc-helper.ts'), '\n// feat 변경\n');
  assert.deepEqual(changedFiles(dir, 'main'), ['src/utils/misc-helper.ts']);
});
test('-로 시작하는 --base 값은 거부한다', () => {
  assert.throws(() => changedFiles(gitCopy(), '--output=x'), /-로 시작할 수 없습니다/);
});
