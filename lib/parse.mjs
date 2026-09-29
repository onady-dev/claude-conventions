// 파일 하나를 해석하는 입구. 주석만 지운 code와 문자열까지 비운 bare를 만들어 각 추출기에 넘긴다.

import { parseClasses } from './parse-classes.mjs';
import { parseExports, parseImports } from './parse-imports.mjs';
import { makeLineIndex, stripComments } from './text.mjs';

const IMPURE_CALLS = [
  { re: /\bnew\s+Date\s*\(\s*\)/g, call: 'new Date()' },
  { re: /\bDate\.now\s*\(/g, call: 'Date.now()' },
  { re: /\bMath\.random\s*\(/g, call: 'Math.random()' },
];

export function parseSource(src) {
  const code = stripComments(src);
  const bare = stripComments(src, { blankStrings: true });
  const lineOf = makeLineIndex(src);
  const imported = parseImports(code, lineOf);
  const classUnparsed = [];
  const classes = parseClasses(bare, code, lineOf, classUnparsed);
  return {
    imports: imported.imports,
    exports: parseExports(bare),
    classes,
    impureCalls: findImpureCalls(bare, lineOf),
    unparsed: [...imported.unparsed, ...classUnparsed].sort((a, b) => a.line - b.line),
  };
}

function findImpureCalls(bare, lineOf) {
  return IMPURE_CALLS
    .flatMap(({ re, call }) => [...bare.matchAll(re)].map((m) => ({ call, line: lineOf(m.index) })))
    .sort((a, b) => a.line - b.line);
}
