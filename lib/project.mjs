// 프로젝트 전체를 읽어 파일별 해석 결과, 계층, import 대상, 역방향 의존을 만든다.

import { readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { loadConfig } from './config.mjs';
import { listSourceFiles } from './files.mjs';
import { matchesAny } from './glob.mjs';
import { parseSource } from './parse.mjs';
import { resolveImport } from './resolve.mjs';

// 끝 줄바꿈 뒤의 빈 조각은 줄로 세지 않는다
export function countLines(src) {
  if (src.length === 0) return 0;
  return src.split('\n').length - (src.endsWith('\n') ? 1 : 0);
}

export function loadProject({ projectRoot, configPath } = {}) {
  const config = loadConfig({ projectRoot, configPath });
  const paths = listSourceFiles(projectRoot, config);
  const fileSet = new Set(paths);
  const files = new Map();
  for (const file of paths) {
    const src = readFileSync(join(projectRoot, file), 'utf8').replace(/^﻿/, '');
    const parsed = safeParse(src);
    files.set(file, {
      file,
      layer: classify(file, config),
      lines: countLines(src),
      moduleDir: moduleDirOf(file, config),
      parsed,
      refs: parsed.imports.map((imp) => ({ ...imp, target: resolveImport(file, imp.spec, fileSet) })),
    });
  }
  const inEdges = new Map(paths.map((p) => [p, []]));
  for (const info of files.values()) {
    for (const ref of info.refs) {
      if (ref.target.kind === 'file') inEdges.get(ref.target.file).push({ from: info.file, typeOnly: ref.typeOnly, line: ref.line });
    }
  }
  return { projectRoot, config, files, inEdges };
}

// 파일 하나의 해석 실패가 전체 실행을 멈추지 않게 한다
function safeParse(src) {
  try {
    return parseSource(src);
  } catch (error) {
    return { imports: [], exports: [], classes: [], impureCalls: [], unparsed: [{ line: 0, text: `해석 실패: ${error.message}` }] };
  }
}

export function classify(file, config) {
  const hit = config.layers.find((entry) => matchesAny(file, entry.match));
  return hit ? hit.layer : 'unclassified';
}

export function moduleDirOf(file, config) {
  const prefix = `${config.modulesDir}/`;
  if (!file.startsWith(prefix)) return null;
  const rest = file.slice(prefix.length).split('/');
  return rest.length > 1 ? rest[0] : null;
}

// Nest 모듈 파일의 표시 이름. 폴더 이름과 파일 이름이 다르면 '폴더/파일'
export function moduleLabel(file, config) {
  const prefix = `${config.modulesDir}/`;
  if (!file.startsWith(prefix)) return file;
  const rel = file.slice(prefix.length);
  const dir = posix.dirname(rel);
  const base = posix.basename(rel).replace(/\.module\.ts$/, '').replace(/\.ts$/, '');
  return posix.basename(dir) === base ? dir : `${dir}/${base}`;
}
