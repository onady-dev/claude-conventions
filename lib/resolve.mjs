// import 경로를 프로젝트 파일 또는 패키지 이름으로 해석한다.
// 상대 경로만 파일로 본다. tsconfig paths 별칭은 해석하지 않는다(패키지로 보인다).

import { posix } from 'node:path';

export function packageName(spec) {
  if (spec.startsWith('node:')) return spec;
  const parts = spec.split('/');
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

export function resolveImport(fromFile, spec, fileSet) {
  if (!spec.startsWith('.')) return { kind: 'package', name: packageName(spec) };
  const base = posix.normalize(posix.join(posix.dirname(fromFile), spec));
  const stem = base.replace(/\.(js|mjs|cjs)$/, '');
  for (const candidate of [base, `${stem}.ts`, `${stem}/index.ts`]) {
    if (fileSet.has(candidate)) return { kind: 'file', file: candidate };
  }
  return { kind: 'missing', spec };
}
