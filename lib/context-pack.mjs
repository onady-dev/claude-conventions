// 모듈(또는 파일) 하나의 구조를 AI가 파일을 열지 않고 읽을 수 있는 요약으로 가공한다.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { listSpecFiles } from './files.mjs';
import { moduleLabel } from './project.mjs';
import { compareStrings, sortKeys } from './sort.mjs';

const HTTP_DECORATORS = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Head', 'Options'];
const MESSAGE_DECORATORS = ['MessagePattern', 'EventPattern'];
const COLUMN_DECORATORS = [
  'Column', 'PrimaryColumn', 'PrimaryGeneratedColumn', 'CreateDateColumn', 'UpdateDateColumn', 'DeleteDateColumn', 'VersionColumn',
];

export function buildContextPack(project, target) {
  const scope = resolveTarget(project, target);
  if (scope.error) return scope;
  const infos = scope.files.map((f) => project.files.get(f));
  const acc = { imports: new Set(), packageImports: new Set(), entities: new Map(), controllers: [], routes: [], services: {}, pureExports: {}, dtos: {}, pathWarnings: [] };
  for (const info of infos) collectFile(project, info, acc);
  const pack = {
    target: scope.target,
    config: project.config.source,
    files: infos.map(({ file, layer, lines }) => ({ file, layer, lines })),
    imports: [...acc.imports].sort(compareStrings),
    packageImports: [...acc.packageImports].sort(compareStrings),
    entities: sortKeys(Object.fromEntries(acc.entities)),
    controllers: acc.controllers.sort((a, b) => compareStrings(a.class, b.class)),
    routes: acc.routes.sort((a, b) => compareStrings(a.file, b.file) || a.line - b.line),
    services: sortKeys(acc.services),
    pureExports: sortKeys(acc.pureExports),
    dtos: sortKeys(acc.dtos),
    specs: scope.specs,
    usedBy: usedBy(project, scope.files),
    unparsed: [...infos.flatMap((i) => i.parsed.unparsed.map((u) => ({ file: i.file, ...u }))), ...acc.pathWarnings],
    truncated: false,
    overLimit: false,
  };
  return fitToLimit(pack, project.config.limits.contextPackMaxBytes);
}

function resolveTarget(project, target) {
  const normalized = target.replace(/\\/g, '/').replace(/^\.\//, '');
  if (normalized.endsWith('.ts')) {
    if (!project.files.has(normalized)) return notFound(project, normalized);
    const spec = normalized.replace(/\.ts$/, '.spec.ts');
    return { target: normalized, files: [normalized], specs: existsSync(join(project.projectRoot, spec)) ? [spec] : [] };
  }
  const files = [...project.files.values()].filter((i) => i.moduleDir === normalized).map((i) => i.file);
  if (files.length === 0) return notFound(project, normalized);
  return { target: normalized, files, specs: listSpecFiles(project.projectRoot, `${project.config.modulesDir}/${normalized}`) };
}

function notFound(project, target) {
  const names = [...new Set([...project.files.values()].map((i) => i.moduleDir).filter(Boolean))];
  const candidates = names
    .map((name) => ({ name, d: distance(name, target) }))
    .filter(({ name, d }) => d <= 3 || name.includes(target) || target.includes(name))
    .sort((a, b) => a.d - b.d || compareStrings(a.name, b.name))
    .slice(0, 5)
    .map(({ name }) => name);
  return { error: `대상을 찾지 못했습니다: ${target}`, candidates };
}

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = saved;
    }
  }
  return row[b.length];
}

function collectFile(project, info, acc) {
  const bindings = new Map(info.refs.flatMap((ref) => ref.names.map((n) => [n.local, ref.target])));
  for (const cls of info.parsed.classes) {
    if (cls.module) collectModule(project, cls.module, bindings, acc);
    collectInjectedEntities(project, cls, bindings, acc);
    const ctrl = cls.decorators.find((d) => d.name === 'Controller');
    if (ctrl) {
      collectController(info, cls, ctrl, acc);
      continue;
    }
    if (cls.decorators.some((d) => d.name === 'Injectable')) {
      acc.services[cls.name] = cls.methods
        .filter((m) => m.visibility === 'public' && !m.isStatic)
        .map((m) => `${m.name}(${m.params.join(', ')}) :${m.line}`);
    }
    if (/\/dto\//.test(info.file) || info.file.endsWith('.dto.ts')) acc.dtos[cls.name] = cls.props.map((p) => p.name);
  }
  if (info.layer === 'domain') {
    acc.pureExports[info.file] = info.parsed.exports.filter((e) => e.kind === 'function' || e.kind === 'const').map((e) => e.name);
  }
}

function collectModule(project, mod, bindings, acc) {
  for (const name of mod.imports) {
    const target = bindings.get(name);
    if (target?.kind === 'file') acc.imports.add(moduleLabel(target.file, project.config));
    else if (target?.kind === 'package') acc.packageImports.add(target.name);
  }
  for (const name of mod.forFeature) addEntity(project, name, bindings.get(name), acc);
}

function collectInjectedEntities(project, cls, bindings, acc) {
  for (const param of cls.ctor?.params ?? []) {
    const name = param.decorators.find((d) => d.name === 'InjectRepository')?.args?.trim();
    if (name) addEntity(project, name, bindings.get(name), acc);
  }
}

function addEntity(project, name, target, acc) {
  if (acc.entities.has(name)) return;
  const cls = target?.kind === 'file' ? project.files.get(target.file)?.parsed.classes.find((c) => c.name === name) : null;
  const columns = cls ? cls.props.filter((p) => p.decorators.some((d) => COLUMN_DECORATORS.includes(d.name))).map((p) => p.name) : null;
  acc.entities.set(name, columns);
}

function collectController(info, cls, ctrl, acc) {
  const base = readPath(ctrl, cls.line, info.file, acc);
  const classGuards = guardsOf(cls.decorators);
  acc.controllers.push({ class: cls.name, path: base, file: info.file });
  for (const m of cls.methods) {
    const http = m.decorators.find((d) => HTTP_DECORATORS.includes(d.name));
    const msg = m.decorators.find((d) => MESSAGE_DECORATORS.includes(d.name));
    if (!http && !msg) continue;
    acc.routes.push({
      method: http ? http.name.toUpperCase() : 'MESSAGE',
      path: http ? joinPath(base, readPath(http, m.line, info.file, acc)) : (msg.args ?? ''),
      handler: m.name,
      guards: [...classGuards, ...guardsOf(m.decorators)],
      decorators: m.decorators.filter((d) => d !== http && d !== msg && d.name !== 'UseGuards').map((d) => d.name),
      file: info.file,
      line: m.line,
    });
  }
}

// 데코레이터 경로를 문자열 리터럴로 읽는다. 읽지 못하면 빈 경로로 두고 unparsed에 남긴다
function readPath(decorator, line, file, acc) {
  const path = firstString(decorator.args);
  const args = decorator.args?.trim();
  if (path === null && args) {
    acc.pathWarnings.push({ file, line, text: `@${decorator.name} 경로를 문자열로 읽지 못함: ${args}` });
  }
  return path ?? '';
}

const firstString = (args) => args?.match(/^\s*['"`]([^'"`]*)['"`]/)?.[1] ?? null;

const guardsOf = (decorators) => decorators
  .filter((d) => d.name === 'UseGuards')
  .flatMap((d) => (d.args ?? '').split(',').map((s) => s.trim()).filter(Boolean));

const joinPath = (a, b) => [a, b].filter(Boolean).join('/').replace(/\/{2,}/g, '/');

// 이 파일들을 import하는 바깥 모듈. 모듈 밖의 framework 파일(app.module, main)은 뺀다
function usedBy(project, files) {
  const inside = new Set(files);
  const labels = new Set();
  for (const f of files) {
    for (const edge of project.inEdges.get(f) ?? []) {
      if (inside.has(edge.from)) continue;
      const src = project.files.get(edge.from);
      if (src.moduleDir) labels.add(src.moduleDir);
      else if (src.layer !== 'framework') labels.add(src.file);
    }
  }
  return [...labels].sort(compareStrings);
}

const byteLength = (obj) => Buffer.byteLength(JSON.stringify(obj));

function fitToLimit(pack, maxBytes) {
  if (byteLength(pack) <= maxBytes) return pack;
  const reduced = {
    ...pack,
    truncated: true,
    services: Object.fromEntries(Object.entries(pack.services).map(([k, v]) => [k, v.map((s) => s.split('(')[0])])),
    routes: pack.routes.map(({ decorators, ...rest }) => rest),
  };
  return { ...reduced, overLimit: byteLength(reduced) > maxBytes };
}
