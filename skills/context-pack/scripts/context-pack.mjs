#!/usr/bin/env node
// 설치본은 같은 폴더의 lib/를, 원본 저장소에서는 저장소 루트의 lib/를 쓴다.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const installed = join(here, 'lib', 'extract.mjs');
const libEntry = existsSync(installed) ? installed : join(here, '..', '..', '..', 'lib', 'extract.mjs');
let lib = null;
try {
  lib = await import(pathToFileURL(libEntry).href);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ error: `공통 lib를 불러오지 못했습니다: ${error.message}` })}
`);
  process.exitCode = 2;
}

const USAGE = '사용법: context-pack.mjs <모듈 이름|파일 경로> [--root 프로젝트 루트] [--config arch.json 경로] [--out 결과 파일]';

if (lib) {
  const { loadProject, buildContextPack, runCli } = lib;
  runCli(({ values, positionals, projectRoot }) => {
    if (positionals.length !== 1) return { result: { error: USAGE }, exitCode: 2 };
    const project = loadProject({ projectRoot, configPath: values.config });
    const result = buildContextPack(project, positionals[0]);
    return { result, exitCode: result.error ? 2 : 0 };
  }, { allowPositionals: true });
}
