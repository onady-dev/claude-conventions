// 프로젝트 전체(또는 변경 파일)의 규칙 위반을 모으고, 모듈 순환과 요약을 붙인다.

import { RULES, checkControllers, checkImports, checkImpure } from './arch-rules.mjs';
import { compareStrings, sortKeys } from './sort.mjs';

export function runArchScan(project, { onlyFiles = null } = {}) {
  const scanned = [...project.files.values()].filter((i) => onlyFiles === null || onlyFiles.has(i.file));
  const cycles = findModuleCycles(project, onlyFiles);
  const sorted = [
    ...scanned.flatMap((i) => [...checkImports(i, project), ...checkImpure(i), ...checkControllers(i, project.config)]),
    ...cycles.map((mods) => ({
      rule: 'CA-DEP-02',
      severity: RULES['CA-DEP-02'].severity,
      file: `cycle:${mods.join(',')}`,
      line: 0,
      message: mods.join(' ↔ '),
    })),
  ]
    .sort((a, b) => compareStrings(a.rule, b.rule) || compareStrings(a.file, b.file) || a.line - b.line);
  const violations = markBaseline(sorted, project.config.baseline);
  const { largeServiceLines } = project.config.limits;
  return {
    mode: onlyFiles === null ? 'all' : 'changed',
    config: project.config.source,
    summary: summarize(scanned, violations),
    violations,
    cycles,
    unclassified: scanned.filter((i) => i.layer === 'unclassified').map((i) => i.file),
    unparsed: scanned.flatMap((i) => i.parsed.unparsed.map((u) => ({ file: i.file, ...u }))),
    reviewHints: scanned
      .filter((i) => i.layer === 'usecase' && i.lines > largeServiceLines)
      .map((i) => ({ file: i.file, lines: i.lines, hint: '순수 로직으로 뺄 판정 코드가 있는지 검토(CA-PURE-04, CA-OPT-02)' })),
    rules: Object.fromEntries([...new Set(violations.map((v) => v.rule))].sort(compareStrings).map((id) => [id, RULES[id]])),
  };
}

// (rule, file)마다 허용량을 정하고, 정렬된 순서(줄 번호순)대로 허용량이 남은 동안만 기존 위반으로 본다.
// count 없는 항목은 무제한이다. 허용량을 넘는 위반은 신규(baseline: false)다.
function markBaseline(sortedViolations, baseline) {
  const allowance = new Map();
  for (const b of baseline) {
    const key = `${b.rule}|${b.file}`;
    const add = b.count === undefined ? Infinity : b.count;
    allowance.set(key, (allowance.get(key) ?? 0) + add);
  }
  return sortedViolations.map((v) => {
    const key = `${v.rule}|${v.file}`;
    const left = allowance.get(key) ?? 0;
    if (left <= 0) return { ...v, baseline: false };
    allowance.set(key, left - 1);
    return { ...v, baseline: true };
  });
}

function summarize(scanned, violations) {
  const byRule = {};
  for (const v of violations) {
    const slot = byRule[v.rule] ?? { new: 0, baseline: 0 };
    const key = v.baseline ? 'baseline' : 'new';
    byRule[v.rule] = { ...slot, [key]: slot[key] + 1 };
  }
  const fresh = violations.filter((v) => !v.baseline);
  const unclassified = scanned.filter((i) => i.layer === 'unclassified').length;
  return {
    files: scanned.length,
    classified: scanned.length - unclassified,
    unclassified,
    byRule: sortKeys(byRule),
    newErrors: fresh.filter((v) => v.severity === 'error').length,
    newWarnings: fresh.filter((v) => v.severity === 'warn').length,
  };
}

// 기능 모듈 사이 순환. import type은 실행 시점 의존이 아니라서 뺀다
function findModuleCycles(project, onlyFiles) {
  const graph = new Map();
  for (const info of project.files.values()) {
    if (!info.moduleDir) continue;
    if (!graph.has(info.moduleDir)) graph.set(info.moduleDir, new Set());
    for (const ref of info.refs) {
      if (ref.target.kind !== 'file' || ref.typeOnly) continue;
      const to = project.files.get(ref.target.file).moduleDir;
      if (to && to !== info.moduleDir) graph.get(info.moduleDir).add(to);
    }
  }
  const touched = onlyFiles === null ? null : new Set([...onlyFiles].map((f) => project.files.get(f)?.moduleDir).filter(Boolean));
  return stronglyConnected(graph)
    .filter((c) => c.length > 1)
    .map((c) => [...c].sort(compareStrings))
    .filter((c) => touched === null || c.some((m) => touched.has(m)))
    .sort((a, b) => compareStrings(a.join(','), b.join(',')));
}

// Tarjan 알고리즘: 서로 도달 가능한 노드 묶음(강한 연결 요소)을 찾는다
function stronglyConnected(graph) {
  let counter = 0;
  const index = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const result = [];
  const visit = (v) => {
    index.set(v, counter);
    low.set(v, counter);
    counter += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), index.get(w)));
      }
    }
    if (low.get(v) === index.get(v)) {
      const component = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      result.push(component);
    }
  };
  for (const v of graph.keys()) if (!index.has(v)) visit(v);
  return result;
}
