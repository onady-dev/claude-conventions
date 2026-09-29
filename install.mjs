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
