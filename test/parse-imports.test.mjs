import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeLineIndex, stripComments } from '../lib/text.mjs';
import { parseExports, parseImports } from '../lib/parse-imports.mjs';

const CODE = [
  "import { A, B as C } from './a';",
  "import type { T } from '../t';",
  "import D, { type E } from 'pkg';",
  "import * as ns from '@scope/lib/sub';",
  'import {',
  '  F,',
  '  G,',
  "} from './multi';",
  "import './side';",
  "export { H } from './h';",
  "export * from './all';",
  "import { type X, type Y } from './types';",
  'import broken',
].join('\n');

test('import 문의 대상·이름·type 여부·줄 번호를 소스 순서로 뽑는다', () => {
  const { imports } = parseImports(CODE, makeLineIndex(CODE));
  assert.deepEqual(imports.map((i) => i.spec), ['./a', '../t', 'pkg', '@scope/lib/sub', './multi', './side', './h', './all', './types']);
  assert.deepEqual(imports[0].names, [
    { local: 'A', imported: 'A', typeOnly: false },
    { local: 'C', imported: 'B', typeOnly: false },
  ]);
  assert.equal(imports[1].typeOnly, true);
  assert.equal(imports[2].typeOnly, false);
  assert.deepEqual(imports[2].names, [
    { local: 'D', imported: 'default', typeOnly: false },
    { local: 'E', imported: 'E', typeOnly: true },
  ]);
  assert.deepEqual(imports[3].names, [{ local: 'ns', imported: '*', typeOnly: false }]);
  assert.equal(imports[4].line, 5);
  assert.deepEqual(imports[4].names.map((n) => n.local), ['F', 'G']);
  assert.equal(imports[5].kind, 'side-effect');
  assert.equal(imports[6].kind, 'export');
  assert.deepEqual(imports[7].names, []);
  assert.equal(imports[8].typeOnly, true);
});

test('해석하지 못한 import 줄은 unparsed로 드러낸다', () => {
  const { unparsed } = parseImports(CODE, makeLineIndex(CODE));
  assert.deepEqual(unparsed, [{ line: 13, text: 'import broken' }]);
});

test('주석 처리된 import와 동적 import()는 무시한다', () => {
  const code = stripComments("// import { Z } from './z';\nconst m = await import('./dyn');\n");
  const result = parseImports(code, makeLineIndex(code));
  assert.deepEqual(result, { imports: [], unparsed: [] });
});

test('export 선언의 이름과 종류를 뽑는다', () => {
  const bare = stripComments(
    [
      'export function a() {}',
      'export const b = 1;',
      'export async function c() {}',
      'export default class D {}',
      'export interface E {}',
      'export type F = string;',
      'export enum G { X }',
      "export { H } from './h';",
    ].join('\n'),
    { blankStrings: true },
  );
  assert.deepEqual(parseExports(bare), [
    { name: 'a', kind: 'function' },
    { name: 'b', kind: 'const' },
    { name: 'c', kind: 'function' },
    { name: 'D', kind: 'class' },
    { name: 'E', kind: 'interface' },
    { name: 'F', kind: 'type' },
    { name: 'G', kind: 'enum' },
  ]);
});

test('키워드로 시작하는 식별자를 export 선언으로 오인하지 않는다', () => {
  const bare = stripComments(
    ['export default functionName;', 'export default class extends Base {}', 'export async function run() {}', 'export default enumValue;', 'export default classify(x);', 'export default typeName;', 'export const enum K { A }', 'export function* gen() {}', 'export let counter = 0;'].join('\n'),
    { blankStrings: true },
  );
  assert.deepEqual(parseExports(bare), [
    { name: 'run', kind: 'function' },
    { name: 'K', kind: 'enum' },
    { name: 'gen', kind: 'function' },
    { name: 'counter', kind: 'const' },
  ]);
});
