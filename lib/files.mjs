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
