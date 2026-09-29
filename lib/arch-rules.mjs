// 규칙 메타데이터와 파일 단위 검사. 규칙 문서(rules/clean-arch)의 ID와 1:1로 대응한다.

import { matchesAny } from './glob.mjs';

export const RULES = Object.freeze({
  'CA-DEP-01': { severity: 'error', doc: 'clean-arch/common/dependency.md', title: '도메인이 바깥 계층을 import' },
  'CA-DEP-02': { severity: 'error', doc: 'clean-arch/common/dependency.md', title: '모듈 간 순환 의존' },
  'CA-PURE-01': { severity: 'error', doc: 'clean-arch/common/pure-logic.md', title: '도메인이 외부 패키지를 import' },
  'CA-PURE-02': { severity: 'error', doc: 'clean-arch/common/pure-logic.md', title: '도메인이 엔티티를 일반 import' },
  'CA-PURE-03': { severity: 'warn', doc: 'clean-arch/common/pure-logic.md', title: '도메인이 시간·랜덤을 직접 호출' },
  'CA-EXT-01': { severity: 'error', doc: 'clean-arch/common/boundaries.md', title: '외부 SDK를 허용 파일 밖에서 import' },
  'CA-EXT-02': { severity: 'error', doc: 'clean-arch/common/boundaries.md', title: '유스케이스가 어댑터를 직접 import' },
  'CA-CTRL-01': { severity: 'warn', doc: 'clean-arch/common/boundaries.md', title: '컨트롤러 핸들러가 김' },
  'CA-CTRL-02': { severity: 'error', doc: 'clean-arch/common/boundaries.md', title: '컨트롤러가 DB 접근 객체를 직접 주입' },
});

const HANDLER_DECORATORS = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Head', 'Options', 'MessagePattern', 'EventPattern'];
const DB_INJECT_DECORATORS = ['InjectRepository', 'InjectDataSource', 'InjectEntityManager'];
const DB_TYPE_RE = /^(?:Repository|DataSource|EntityManager)\b/;

const violation = (rule, file, line, detail) => ({ rule, severity: RULES[rule].severity, file, line, ...detail });

// 허용표: 행이 import하는 쪽. domain과 usecase 행에만 금지 칸이 있다.
export function layerRule(fromLayer, toLayer, typeOnly) {
  if (fromLayer === 'domain') {
    if (toLayer === 'domain' || toLayer === 'unclassified') return null;
    if (toLayer === 'entity') return typeOnly ? null : 'CA-PURE-02';
    return 'CA-DEP-01';
  }
  if (fromLayer === 'usecase' && toLayer === 'adapter') return 'CA-EXT-02';
  return null;
}

export function checkImports(info, project) {
  return info.refs.flatMap((ref) => {
    if (ref.target.kind === 'package') return checkPackage(info, ref, project.config);
    if (ref.target.kind !== 'file') return [];
    const target = project.files.get(ref.target.file);
    const rule = layerRule(info.layer, target.layer, ref.typeOnly);
    if (!rule) return [];
    return [violation(rule, info.file, ref.line, { from: info.layer, to: target.file, message: `${info.layer} → ${target.layer}` })];
  });
}

function checkPackage(info, ref, config) {
  const name = ref.target.name;
  const found = [];
  const allowed = Object.hasOwn(config.externals, name) ? config.externals[name] : null;
  if (allowed && !matchesAny(info.file, allowed)) {
    found.push(violation('CA-EXT-01', info.file, ref.line, { to: name, message: `${name}은(는) ${allowed.join(', ')}에서만 import` }));
  }
  if (info.layer === 'domain' && !config.domainAllowedPackages.includes(name)) {
    found.push(violation('CA-PURE-01', info.file, ref.line, { to: name, message: `도메인에서 ${name} import` }));
  }
  return found;
}

export function checkImpure(info) {
  if (info.layer !== 'domain') return [];
  return info.parsed.impureCalls.map((c) => violation('CA-PURE-03', info.file, c.line, { message: `${c.call} 직접 호출` }));
}

export function checkControllers(info, config) {
  const max = config.limits.controllerHandlerMaxLines;
  return info.parsed.classes
    .filter((cls) => cls.decorators.some((d) => d.name === 'Controller'))
    .flatMap((cls) => [
      ...(cls.ctor?.params ?? []).filter(isDbInjection).map((p) => violation('CA-CTRL-02', info.file, cls.ctor.line, {
        to: p.type ?? p.name,
        message: `${cls.name}이(가) ${p.name} 주입`,
      })),
      ...cls.methods
        .filter((m) => m.decorators.some((d) => HANDLER_DECORATORS.includes(d.name)) && m.bodyLines > max)
        .map((m) => violation('CA-CTRL-01', info.file, m.line, { message: `${cls.name}.${m.name} 본문 ${m.bodyLines}줄 (상한 ${max})` })),
    ]);
}

const isDbInjection = (p) => p.decorators.some((d) => DB_INJECT_DECORATORS.includes(d.name)) || DB_TYPE_RE.test(p.type ?? '');
