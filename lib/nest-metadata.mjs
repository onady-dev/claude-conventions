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
