// 출력 JSON을 실행할 때마다 같게 만들기 위한 정렬 도구. localeCompare는 환경마다 결과가 달라 쓰지 않는다.

export function compareStrings(a, b) {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

export function sortKeys(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => compareStrings(a, b)));
}
