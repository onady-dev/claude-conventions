// 스킬 스크립트 공통 실행기: 인자 해석 → main 실행 → 한 줄 JSON 출력 → 종료 코드 설정.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const COMMON_OPTIONS = { root: { type: 'string' }, config: { type: 'string' }, out: { type: 'string' } };

export function runCli(main, { options = {}, allowPositionals = false, argv = process.argv.slice(2) } = {}) {
  let exitCode = 2;
  try {
    const { values, positionals } = parseArgs({ args: argv, options: { ...COMMON_OPTIONS, ...options }, allowPositionals, strict: true });
    const outcome = main({ values, positionals, projectRoot: resolve(values.root ?? process.cwd()) });
    emit(outcome.result, values.out);
    exitCode = outcome.exitCode;
  } catch (error) {
    emit({ error: error.message });
    exitCode = 2;
  }
  process.exitCode = exitCode;
}

function emit(result, out) {
  const json = JSON.stringify(result);
  if (!out) {
    process.stdout.write(`${json}\n`);
    return;
  }
  writeFileSync(out, json);
  process.stdout.write(`${JSON.stringify({ written: resolve(out), bytes: Buffer.byteLength(json) })}\n`);
}
