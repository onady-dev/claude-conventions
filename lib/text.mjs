// 소스 텍스트를 구조 분석하기 위한 저수준 도구.
// stripComments는 입력과 같은 길이의 문자열을 돌려주므로, 결과의 오프셋과 줄 번호가 원본과 일치한다.
// 한계: 정규식 리터럴은 따로 인식하지 않는다. 안의 따옴표가 문자열로 오인되면 그 줄 끝에서 복구된다.

const PAIRS = { '(': ')', '[': ']', '{': '}', '<': '>' };

export function stripComments(src, { blankStrings = false } = {}) {
  const out = src.split('');
  const blank = (k) => {
    if (k < out.length && out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
  };
  const exprDepths = [];
  let mode = 'code';
  let depth = 0;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && d === '/') { blank(i); blank(i + 1); mode = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { blank(i); blank(i + 1); mode = 'block'; i += 2; continue; }
      if (c === "'" || c === '"') mode = c;
      else if (c === '`') mode = 'tpl';
      else if (c === '{') depth += 1;
      else if (c === '}') {
        if (exprDepths.length > 0 && exprDepths[exprDepths.length - 1] === depth) {
          exprDepths.pop();
          mode = 'tpl';
        } else {
          depth -= 1;
        }
      }
      i += 1;
      continue;
    }
    if (mode === 'line') {
      if (c === '\n') mode = 'code';
      else blank(i);
      i += 1;
      continue;
    }
    if (mode === 'block') {
      if (c === '*' && d === '/') { blank(i); blank(i + 1); mode = 'code'; i += 2; continue; }
      blank(i);
      i += 1;
      continue;
    }
    // 여기부터는 문자열(' ")이나 템플릿 문자열(`) 안이다
    if (c === '\\') {
      if (blankStrings) { blank(i); blank(i + 1); }
      i += 2;
      continue;
    }
    if (mode === 'tpl' && c === '$' && d === '{') { exprDepths.push(depth); mode = 'code'; i += 2; continue; }
    if ((mode === 'tpl' && c === '`') || c === mode || (mode !== 'tpl' && c === '\n')) {
      mode = 'code';
      i += 1;
      continue;
    }
    if (blankStrings) blank(i);
    i += 1;
  }
  return out.join('');
}

export function makeLineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

// bare: 문자열 내용이 비워진 텍스트여야 한다(문자열 안 괄호를 세지 않기 위해).
export function findClosing(bare, openIdx) {
  const open = bare[openIdx];
  const close = PAIRS[open];
  if (!close) return -1;
  let depth = 0;
  for (let i = openIdx; i < bare.length; i++) {
    const c = bare[i];
    if (open === '<' && c === '>' && bare[i - 1] === '=') continue; // 화살표 =>
    if (c === open) depth += 1;
    else if (c === close) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function splitTopLevel(bare, start, end, sep = ',') {
  const ranges = [];
  let depth = 0;
  let segStart = start;
  for (let i = start; i < end; i++) {
    const c = bare[i];
    if (c === '(' || c === '[' || c === '{' || c === '<') depth += 1;
    else if (c === ')' || c === ']' || c === '}' || (c === '>' && bare[i - 1] !== '=')) depth -= 1;
    else if (c === sep && depth === 0) {
      ranges.push([segStart, i]);
      segStart = i + 1;
    }
  }
  ranges.push([segStart, end]);
  return ranges.filter(([s, e]) => bare.slice(s, e).trim() !== '');
}

export function lineTextAt(text, offset) {
  const start = text.lastIndexOf('\n', offset - 1) + 1;
  const nl = text.indexOf('\n', offset);
  return text.slice(start, nl === -1 ? text.length : nl).trim().slice(0, 120);
}
