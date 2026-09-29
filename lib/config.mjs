// 프로젝트별 설정(.claude/arch.json)을 읽는다. 파일이 없으면 NestJS 기본값으로 동작한다.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripComments } from './text.mjs';

export const LAYERS = Object.freeze(['domain', 'usecase', 'adapter', 'entity', 'framework']);

export const DEFAULT_CONFIG = Object.freeze({
  root: 'src',
  modulesDir: 'src/modules',
  exclude: ['**/*.spec.ts', '**/*.test.ts', '**/*.d.ts'],
  // 위에서부터 처음 맞는 규칙을 적용한다
  layers: [
    { layer: 'framework', match: ['**/main.ts', '**/*.module.ts'] },
    { layer: 'entity', match: ['**/*.entity.ts'] },
    {
      layer: 'adapter',
      match: [
        '**/*.controller.ts', '**/*.guard.ts', '**/*.strategy.ts', '**/*.middleware.ts', '**/*.filter.ts',
        '**/*.interceptor.ts', '**/*.adapter.ts', '**/*.client.ts', '**/*.repository.ts',
      ],
    },
    { layer: 'usecase', match: ['**/*.service.ts', '**/*.scheduler.ts', '**/*.port.ts', '**/*.dto.ts', '**/dto/**'] },
    { layer: 'domain', match: ['**/*.policy.ts', '**/*.domain.ts', '**/domain/**'] },
  ],
  externals: {},
  domainAllowedPackages: [],
  baseline: [],
  limits: { controllerHandlerMaxLines: 15, largeServiceLines: 500, contextPackMaxBytes: 20000 },
});

export function loadConfig({ projectRoot, configPath } = {}) {
  const path = configPath ? resolve(configPath) : join(projectRoot, '.claude', 'arch.json');
  if (!existsSync(path)) {
    if (configPath) throw new Error(`설정 파일이 없습니다: ${path}`);
    return { ...DEFAULT_CONFIG, source: null };
  }
  let user;
  try {
    user = JSON.parse(stripComments(readFileSync(path, 'utf8')));
  } catch (error) {
    throw new Error(`설정 파일을 읽지 못했습니다(${path}): ${error.message}`);
  }
  validate(user, path);
  return {
    ...DEFAULT_CONFIG,
    ...user,
    limits: { ...DEFAULT_CONFIG.limits, ...(user.limits ?? {}) },
    source: path,
  };
}

const isStringArray = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string');
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function validate(user, path) {
  if (user === null || typeof user !== 'object' || Array.isArray(user)) {
    throw new Error(`설정 최상위는 객체여야 합니다: ${path}`);
  }
  if (user.layers !== undefined) {
    if (!Array.isArray(user.layers)) throw new Error('layers는 배열이어야 합니다');
    for (const entry of user.layers) {
      if (!LAYERS.includes(entry?.layer)) {
        throw new Error(`알 수 없는 계층 '${entry?.layer}' (허용: ${LAYERS.join(', ')})`);
      }
      if (!isStringArray(entry.match)) throw new Error(`계층 '${entry.layer}'의 match는 문자열 배열이어야 합니다`);
    }
  }
  for (const key of ['exclude', 'domainAllowedPackages']) {
    if (user[key] !== undefined && !isStringArray(user[key])) throw new Error(`${key}는 문자열 배열이어야 합니다`);
  }
  if (user.externals !== undefined) {
    if (!isPlainObject(user.externals)) {
      throw new Error('externals는 { 패키지: [파일 패턴] } 객체여야 합니다');
    }
    if (!Object.values(user.externals).every(isStringArray)) {
      throw new Error('externals는 { 패키지: [파일 패턴] } 객체여야 합니다');
    }
  }
  for (const key of ['root', 'modulesDir']) {
    if (user[key] !== undefined) {
      if (typeof user[key] !== 'string' || user[key] === '') {
        throw new Error(`${key}는 비어 있지 않은 문자열이어야 합니다`);
      }
    }
  }
  if (user.limits !== undefined) {
    if (!isPlainObject(user.limits)) {
      throw new Error('limits는 객체여야 합니다');
    }
    const allowedKeys = ['controllerHandlerMaxLines', 'largeServiceLines', 'contextPackMaxBytes'];
    for (const key of Object.keys(user.limits)) {
      if (!allowedKeys.includes(key)) {
        throw new Error(`알 수 없는 limits 항목 '${key}'`);
      }
      const value = user.limits[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new Error(`limits.${key}는 양수여야 합니다`);
      }
    }
  }
  const baselineOk = user.baseline === undefined
    || (Array.isArray(user.baseline) && user.baseline.every((b) => typeof b?.rule === 'string' && typeof b?.file === 'string'));
  if (!baselineOk) throw new Error('baseline 항목에는 rule과 file 문자열이 필요합니다');
  const countOk = (user.baseline ?? []).every((b) => b.count === undefined || (Number.isInteger(b.count) && b.count > 0));
  if (!countOk) throw new Error('baseline의 count는 양의 정수여야 합니다');
}
