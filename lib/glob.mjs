// 경로 패턴(**, *, ?)을 정규식으로 바꾼다.
// Node 22의 path.matchesGlob은 실험 기능 경고가 출력에 섞이므로 쓰지 않는다.

const cache = new Map();

export function globToRegExp(pattern) {
  const hit = cache.get(pattern);
  if (hit) return hit;
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*' && pattern[i + 1] === '*') {
      const slashAfter = pattern[i + 2] === '/';
      re += slashAfter ? '(?:.*/)?' : '.*';
      i += slashAfter ? 2 : 1;
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  const compiled = new RegExp(`^${re}$`);
  cache.set(pattern, compiled);
  return compiled;
}

export function matchesAny(path, patterns) {
  return patterns.some((p) => globToRegExp(p).test(path));
}
