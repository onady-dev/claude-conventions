// import/export 문을 정규식으로 뽑는다.
// import 절 모양을 정확히 제한해, 앞 문장과 뒤 문장의 from이 이어 붙는 오인을 막는다.

import { lineTextAt } from './text.mjs';

const CLAUSE = String.raw`(\{[^}]*\}|\*(?:\s+as\s+[\w$]+)?|[\w$]+(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+[\w$]+))?)`;
const FROM_RE = new RegExp(String.raw`^[ \t]*(import|export)\s+(type\s+)?${CLAUSE}\s*from\s*(['"])([^'"\n]+)\4`, 'gm');
const SIDE_EFFECT_RE = /^[ \t]*import\s*(['"])([^'"\n]+)\1/gm;
const IMPORT_LINE_RE = /^[ \t]*import\b(?!\s*\()/gm;
const EXPORT_RE = /^[ \t]*export\s+(?:default\s+)?(?:declare\s+)?(?:(async\s+function|function)(?:\s*\*\s*|\s+)|(const\s+enum|const|let|var|abstract\s+class|class|interface|type|enum)\s+)(?!(?:extends|implements)\b)([A-Za-z_$][\w$]*)/gm;
const EXPORT_KIND = {
  'async function': 'function',
  function: 'function',
  'const enum': 'enum',
  const: 'const',
  let: 'const',
  var: 'const',
  'abstract class': 'class',
  class: 'class',
  interface: 'interface',
  type: 'type',
  enum: 'enum',
};

export function parseImports(code, lineOf) {
  const found = [];
  for (const m of code.matchAll(FROM_RE)) {
    const typeAll = Boolean(m[2]);
    const names = parseClause(m[3], typeAll);
    found.push({
      kind: m[1],
      spec: m[5],
      typeOnly: typeAll || (names.length > 0 && names.every((n) => n.typeOnly)),
      names,
      line: lineOf(m.index),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  for (const m of code.matchAll(SIDE_EFFECT_RE)) {
    found.push({ kind: 'side-effect', spec: m[2], typeOnly: false, names: [], line: lineOf(m.index), start: m.index, end: m.index + m[0].length });
  }
  found.sort((a, b) => a.start - b.start);
  const unparsed = [];
  for (const m of code.matchAll(IMPORT_LINE_RE)) {
    const covered = found.some((f) => m.index >= f.start && m.index < f.end);
    if (!covered) unparsed.push({ line: lineOf(m.index), text: lineTextAt(code, m.index) });
  }
  return { imports: found.map(({ start, end, ...rest }) => rest), unparsed };
}

function parseClause(clause, typeAll) {
  const namespaceOnly = clause.match(/^\*\s+as\s+([\w$]+)$/);
  if (namespaceOnly) return [{ local: namespaceOnly[1], imported: '*', typeOnly: typeAll }];
  if (clause === '*') return [];
  const names = [];
  const braceAt = clause.indexOf('{');
  const head = braceAt === -1 ? clause : clause.slice(0, braceAt);
  for (const part of head.split(',').map((s) => s.trim()).filter(Boolean)) {
    const ns = part.match(/^\*\s+as\s+([\w$]+)$/);
    names.push(ns ? { local: ns[1], imported: '*', typeOnly: typeAll } : { local: part, imported: 'default', typeOnly: typeAll });
  }
  if (braceAt !== -1) {
    const inner = clause.slice(braceAt + 1, clause.lastIndexOf('}'));
    for (const spec of inner.split(',').map((s) => s.trim()).filter(Boolean)) {
      const m = spec.match(/^(type\s+)?([\w$]+)(?:\s+as\s+([\w$]+))?$/);
      if (m) names.push({ local: m[3] ?? m[2], imported: m[2], typeOnly: typeAll || Boolean(m[1]) });
    }
  }
  return names;
}

export function parseExports(bare) {
  return [...bare.matchAll(EXPORT_RE)].map((m) => ({ name: m[3], kind: EXPORT_KIND[(m[1] ?? m[2]).replace(/\s+/g, ' ')] }));
}
