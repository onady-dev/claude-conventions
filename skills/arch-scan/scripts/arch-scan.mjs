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

if (lib) {
  const { loadProject, runArchScan, changedFiles, runCli } = lib;
  runCli(({ values, projectRoot }) => {
    const project = loadProject({ projectRoot, configPath: values.config });
    const onlyFiles = values.all ? null : new Set(changedFiles(projectRoot, values.base ?? 'HEAD'));
    const result = runArchScan(project, { onlyFiles });
    return { result, exitCode: result.summary.newErrors > 0 ? 1 : 0 };
  }, {
    options: { all: { type: 'boolean' }, changed: { type: 'boolean' }, base: { type: 'string' } },
  });
}
