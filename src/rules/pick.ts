/**
 * 후보 풀에서 서로 다른 n개를 균등 확률로 뽑는다. 스펙 05.
 * 부분 Fisher-Yates를 복사본에 적용하므로 입력은 바뀌지 않는다.
 * 풀이 n개 미만이면 Error('NOT_ENOUGH')를 던진다.
 */
export function pickCandidates<T>(pool: T[], n = 3, rng: () => number = Math.random): T[] {
  if (pool.length < n) throw new Error('NOT_ENOUGH')
  const arr = [...pool]
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (arr.length - i))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, n)
}
