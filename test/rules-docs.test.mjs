import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../lib/arch-rules.mjs';

const RULES_DIR = fileURLToPath(new URL('../rules', import.meta.url));
const EXPECTED = [
  'clean-arch/common/00-overview.md',
  'clean-arch/common/boundaries.md',
  'clean-arch/common/dependency.md',
  'clean-arch/common/optional.md',
  'clean-arch/common/pure-logic.md',
  'clean-arch/typescript/nestjs-layers.md',
  'clean-arch/typescript/nestjs-ports.md',
  'clean-arch/typescript/typeorm.md',
];

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const docs = () => walk(RULES_DIR).map((abs) => ({ rel: relative(RULES_DIR, abs).split(sep).join('/'), text: readFileSync(abs, 'utf8') }));

test('규칙 문서 8개가 정해진 위치에 있다', () => {
  assert.deepEqual(docs().map((d) => d.rel).sort(), EXPECTED);
});

test('모든 규칙 문서는 paths frontmatter로 시작한다', () => {
  for (const { rel, text } of docs()) assert.match(text, /^---\r?\npaths:\r?\n(?: {2}- ".+"\r?\n)+---\r?\n/, rel);
});

test('모든 규칙 문서는 100줄 이내다', () => {
  for (const { rel, text } of docs()) assert.ok(text.split('\n').length <= 100, `${rel}: ${text.split('\n').length}줄`);
});

test('arch-scan 규칙 ID마다 해당 문서에 제목이 있다', () => {
  for (const [id, meta] of Object.entries(RULES)) {
    const text = readFileSync(join(RULES_DIR, meta.doc), 'utf8');
    assert.match(text, new RegExp(`^### ${id} `, 'm'), `${meta.doc}에 ${id} 제목 없음`);
  }
});

test('규칙 ID 제목은 전체 문서에서 중복되지 않는다', () => {
  const ids = docs().flatMap(({ text }) => [...text.matchAll(/^### (CA-[A-Z]+-\d{2}) /gm)].map((m) => m[1]));
  assert.equal(new Set(ids).size, ids.length, ids.join(', '));
  assert.deepEqual([...ids].sort(), [
    'CA-CTRL-01', 'CA-CTRL-02',
    'CA-DEP-01', 'CA-DEP-02', 'CA-DEP-03',
    'CA-EXT-01', 'CA-EXT-02', 'CA-EXT-03',
    'CA-OPT-01', 'CA-OPT-02', 'CA-OPT-03',
    'CA-PURE-01', 'CA-PURE-02', 'CA-PURE-03', 'CA-PURE-04', 'CA-PURE-05',
  ]);
});

test('arch-scan이 안내하는 AI 판정 규칙도 문서에 있다', () => {
  const all = docs().map((d) => d.text).join('\n');
  for (const id of ['CA-PURE-04', 'CA-OPT-02']) assert.match(all, new RegExp(`^### ${id} `, 'm'), id);
});

test('원문자 같은 장식 문자를 쓰지 않는다', () => {
  for (const { rel, text } of docs()) assert.doesNotMatch(text, /[①-⓿❶-➓㉠-㉿]/, rel);
});
