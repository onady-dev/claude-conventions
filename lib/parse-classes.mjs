// 클래스 선언과 그 멤버(생성자·메서드·속성)를 뽑는다.
// 구조는 문자열을 비운 bare 텍스트에서 찾고, 인자·타입 원문은 같은 위치의 code 텍스트에서 읽는다.

import { findClosing, splitTopLevel } from './text.mjs';
import { parseModuleMetadata } from './nest-metadata.mjs';

const DECORATOR_RE = /@([A-Za-z_$][\w$]*)(?:\.[A-Za-z_$][\w$]*)*/g;
const CLASS_RE = /^[ \t]*((?:@[A-Za-z_$][\w$.]*(?:[ \t]*\((?:[^()\n]|\([^()\n]*\))*\))?[ \t]*)*)((?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+)([A-Za-z_$][\w$]*)/gm;
const MEMBER_RE = /((?:(?:public|private|protected|static|readonly|async|override|abstract|declare|get|set)\s+)*)(constructor|#?[A-Za-z_$][\w$]*)\s*([?!])?\s*(<[^>(){};]*>)?\s*([(:=;])/y;
const PARAM_MODIFIERS_RE = /^\s*((?:(?:public|private|protected|readonly|override)\s+)*)/;
const VISIBILITY = ['public', 'private', 'protected'];
const PROP_CONTINUES = /[=|&,:(]/;

export function parseClasses(bare, code, lineOf, unparsed) {
  const decorators = collectDecorators(bare, code);
  const ctx = { bare, code, lineOf, unparsed, byStart: new Map(decorators.map((d) => [d.start, d])) };
  const classes = [];
  for (const m of bare.matchAll(CLASS_RE)) {
    const name = m[3];
    const keywordPos = m.index + m[0].length - m[3].length - m[2].length;
    const line = lineOf(m.index);
    const open = bare.indexOf('{', m.index + m[0].length);
    const close = open === -1 ? -1 : findClosing(bare, open);
    if (close === -1) {
      unparsed.push({ line, text: `class ${name}: 본문을 찾지 못함` });
      continue;
    }
    const own = precedingDecorators(bare, decorators, keywordPos);
    const moduleDecorator = own.find((d) => d.name === 'Module' && d.argsRange);
    classes.push({
      name,
      line,
      decorators: own.map(publicDecorator),
      module: moduleDecorator ? parseModuleMetadata(bare, code, moduleDecorator.argsRange) : null,
      ...parseMembers(ctx, open, close),
    });
  }
  return classes;
}

function collectDecorators(bare, code) {
  const list = [];
  for (const m of bare.matchAll(DECORATOR_RE)) {
    let end = m.index + m[0].length;
    let j = end;
    while (j < bare.length && /\s/.test(bare[j])) j += 1;
    let args = null;
    let argsRange = null;
    if (bare[j] === '(') {
      const close = findClosing(bare, j);
      if (close !== -1) {
        args = code.slice(j + 1, close).trim();
        argsRange = [j + 1, close];
        end = close + 1;
      }
    }
    list.push({ name: m[1], args, argsRange, start: m.index, end });
  }
  return list;
}

// pos 바로 앞에 공백만 사이에 두고 이어진 데코레이터들
function precedingDecorators(bare, decorators, pos) {
  const own = [];
  let cursor = pos;
  for (let k = decorators.length - 1; k >= 0; k--) {
    const d = decorators[k];
    if (d.end > cursor) continue;
    if (bare.slice(d.end, cursor).trim() !== '') break;
    own.unshift(d);
    cursor = d.start;
  }
  return own;
}

const publicDecorator = ({ name, args }) => ({ name, args });

function parseMembers(ctx, open, close) {
  const { bare, byStart } = ctx;
  const methods = [];
  const props = [];
  let ctor = null;
  let pending = [];
  let i = open + 1;
  while (i < close) {
    const c = bare[i];
    if (c === ';' || /\s/.test(c)) { i += 1; continue; }
    const decorator = c === '@' ? byStart.get(i) : undefined;
    if (decorator) {
      pending.push(publicDecorator(decorator));
      i = decorator.end;
      continue;
    }
    MEMBER_RE.lastIndex = i;
    const m = MEMBER_RE.exec(bare);
    const member = !m ? null : m[5] === '(' ? parseMethod(ctx, m, close, pending) : parseProp(ctx, m, close, pending);
    if (!member) {
      i = skipLine(ctx, i, close);
      pending = [];
      continue;
    }
    if (member.kind === 'ctor') ctor = member.value;
    else if (member.kind === 'method') methods.push(member.value);
    else props.push(member.value);
    i = member.next;
    pending = [];
  }
  return { ctor, methods, props };
}

function parseMethod(ctx, m, close, decorators) {
  const { bare, lineOf } = ctx;
  const modifiers = m[1].trim().split(/\s+/).filter(Boolean);
  const name = m[2];
  const paramsOpen = m.index + m[0].length - 1;
  const paramsClose = findClosing(bare, paramsOpen);
  if (paramsClose === -1 || paramsClose > close) return null;
  const params = parseParams(ctx, paramsOpen, paramsClose);
  const body = findBody(bare, paramsClose + 1, close);
  const line = lineOf(m.index);
  if (name === 'constructor') return { kind: 'ctor', value: { params, line }, next: body.next };
  return {
    kind: 'method',
    value: {
      name,
      line,
      decorators,
      visibility: name.startsWith('#') ? 'private' : (modifiers.find((x) => VISIBILITY.includes(x)) ?? 'public'),
      isStatic: modifiers.includes('static'),
      isAsync: modifiers.includes('async'),
      params: params.map((p) => p.name),
      bodyLines: body.open === -1 ? 0 : Math.max(0, lineOf(body.close) - lineOf(body.open) - 1),
    },
    next: body.next,
  };
}

// 반환 타입을 건너뛰고 메서드 본문 { } 를 찾는다. ':' '|' '&' '=>' 바로 뒤의 { 는 객체 타입이다.
function findBody(bare, from, limit) {
  let i = from;
  let expectType = false;
  while (i < limit) {
    const c = bare[i];
    if (/\s/.test(c)) { i += 1; continue; }
    if (c === '{' && !expectType) {
      const close = findClosing(bare, i);
      return close === -1 || close > limit ? { open: -1, close: -1, next: limit } : { open: i, close, next: close + 1 };
    }
    if (c === ';') return { open: -1, close: -1, next: i + 1 };
    if (c === ':' || c === '|' || c === '&') { expectType = true; i += 1; continue; }
    if (c === '=' && bare[i + 1] === '>') { expectType = true; i += 2; continue; }
    if ('([{<'.includes(c)) {
      const close = findClosing(bare, i);
      if (close === -1 || close > limit) return { open: -1, close: -1, next: limit };
      i = close + 1;
      expectType = false;
      continue;
    }
    expectType = false;
    i += 1;
  }
  return { open: -1, close: -1, next: limit };
}

function parseParams(ctx, open, close) {
  const { bare, code, byStart } = ctx;
  return splitTopLevel(bare, open + 1, close).map(([s, e]) => {
    const decorators = [];
    let i = s;
    for (;;) {
      while (i < e && /\s/.test(bare[i])) i += 1;
      const d = byStart.get(i);
      if (!d || d.end > e) break;
      decorators.push(publicDecorator(d));
      i = d.end;
    }
    const raw = code.slice(i, e);
    const modifierMatch = raw.match(PARAM_MODIFIERS_RE);
    const modifiers = modifierMatch[1].trim().split(/\s+/).filter(Boolean);
    const rest = raw.slice(modifierMatch[0].length);
    const nameMatch = rest.match(/^(?:\.\.\.)?\s*([A-Za-z_$][\w$]*|\{[\s\S]*?\}|\[[\s\S]*?\])/);
    const name = !nameMatch ? rest.trim() : /^[{[]/.test(nameMatch[1]) ? '{…}' : nameMatch[1];
    const typeMatch = rest.slice(nameMatch ? nameMatch[0].length : 0).match(/^\s*\??\s*:\s*([\s\S]*)$/);
    const type = typeMatch ? typeMatch[1].split(/\s=\s/)[0].trim() : null;
    return { name, type, modifiers, decorators };
  });
}

function parseProp(ctx, m, close, decorators) {
  const { bare, code, lineOf } = ctx;
  const tokIdx = m.index + m[0].length - 1;
  const end = findPropEnd(bare, tokIdx, close);
  const type = m[5] === ':' ? code.slice(tokIdx + 1, end).split(/\s=\s/)[0].trim() : null;
  return {
    kind: 'prop',
    value: { name: m[2], optional: m[3] === '?', type, decorators, line: lineOf(m.index) },
    next: end + 1,
  };
}

// 속성 선언의 끝: 깊이 0의 ';' 또는, 앞 글자가 이어짐을 뜻하지 않는 줄바꿈
function findPropEnd(bare, from, limit) {
  let depth = 0;
  for (let i = from; i < limit; i++) {
    const c = bare[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    else if (depth === 0 && c === ';') return i;
    else if (depth === 0 && c === '\n' && !PROP_CONTINUES.test(bare.slice(from, i).trimEnd().slice(-1))) return i;
  }
  return limit - 1;
}

function skipLine(ctx, i, close) {
  const { bare, code, lineOf, unparsed } = ctx;
  const nl = bare.indexOf('\n', i);
  const end = nl === -1 || nl > close ? close : nl;
  unparsed.push({ line: lineOf(i), text: code.slice(i, end).trim().slice(0, 120) });
  return end + 1;
}
