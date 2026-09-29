// 기준 ref 대비 변경된 파일 목록. -z로 받아 한글 등 비ASCII 경로가 이스케이프되지 않게 한다.

import { execFileSync } from 'node:child_process';
import { compareStrings } from './sort.mjs';

export function changedFiles(projectRoot, base = 'HEAD') {
  const git = (args) => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (base.startsWith('-')) throw new Error('--base 값은 -로 시작할 수 없습니다: ' + base);
  // HEAD가 아니면 분기 지점(merge-base)과 비교해, 기준 브랜치에만 생긴 변경이 섞이지 않게 한다
  const from = base === 'HEAD' ? base : git(['merge-base', base, 'HEAD']).trim();
  const diff = git(['diff', '--name-only', '--relative', '-z', from, '--']);
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']);
  const all = `${diff}\0${untracked}`.split('\0').filter(Boolean);
  return [...new Set(all)].sort(compareStrings);
}
