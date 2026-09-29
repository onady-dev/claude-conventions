import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findClosing, lineTextAt, makeLineIndex, splitTopLevel, stripComments } from '../lib/text.mjs';
import { compareStrings, sortKeys } from '../lib/sort.mjs';

test('줄 주석과 블록 주석을 공백으로 바꾸고 길이와 줄바꿈을 유지한다', () => {
  const src = 'a // x\n/* y\n z */b';
  const out = stripComments(src);
  assert.equal(out.length, src.length);
  assert.equal(out.split('\n').length, 3);
  assert.equal(out.replace(/\s+/g, ''), 'ab');
});

test('문자열 안의 // 와 /* 는 주석으로 보지 않는다', () => {
  const src = "const u = 'http://x'; const v = \"/* no */\";";
  assert.equal(stripComments(src), src);
});

test('템플릿 문자열의 ${} 안 코드의 주석은 지우고 문자열 부분은 보존한다', () => {
  const src = 'const t = `a ${b /* c */} // d`;';
  assert.equal(stripComments(src), 'const t = `a ${b ' + ' '.repeat(7) + '} // d`;');
});

test('blankStrings는 문자열 내용만 공백으로 바꾸고 따옴표와 ${} 코드는 남긴다', () => {
  assert.equal(stripComments("x('ab') + `c${d}e`", { blankStrings: true }), "x('  ') + ` ${d} `");
});

test('이스케이프된 따옴표에서 문자열이 끝나지 않는다', () => {
  const src = "f('a\\'b') // c";
  assert.equal(stripComments(src), "f('a\\'b')" + ' '.repeat(5));
});

test('닫히지 않은 문자열은 줄 끝에서 끝난 것으로 본다', () => {
  const src = "const r = /['\"]/;\nconst x = 1; // c";
  assert.equal(stripComments(src).split('\n')[1].trimEnd(), 'const x = 1;');
});

test('오프셋을 1부터 시작하는 줄 번호로 바꾼다', () => {
  const lineOf = makeLineIndex('a\nbc\nd');
  assert.equal(lineOf(0), 1);
  assert.equal(lineOf(2), 2);
  assert.equal(lineOf(5), 3);
});

test('여는 괄호의 짝 위치를 찾는다', () => {
  assert.equal(findClosing('f(a, (b), [c])', 1), 13);
  const generic = 'Map<A, () => B>';
  assert.equal(findClosing(generic, 3), generic.length - 1);
  assert.equal(findClosing('f(a', 1), -1);
});

test('괄호 깊이 0의 쉼표로만 나눈다', () => {
  const s = 'a, fn(b, c), { d, e }, Map<K, V>, ';
  const parts = splitTopLevel(s, 0, s.length).map(([x, y]) => s.slice(x, y).trim());
  assert.deepEqual(parts, ['a', 'fn(b, c)', '{ d, e }', 'Map<K, V>']);
});

test('오프셋이 속한 줄의 텍스트를 돌려준다', () => {
  assert.equal(lineTextAt('a\n  import broken\nb', 4), 'import broken');
});

test('정렬 도구는 로케일과 무관하게 동작한다', () => {
  assert.deepEqual(['b', 'B', 'a'].sort(compareStrings), ['B', 'a', 'b']);
  assert.deepEqual(Object.keys(sortKeys({ z: 1, a: 2 })), ['a', 'z']);
});
