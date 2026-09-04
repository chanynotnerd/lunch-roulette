const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Postgres uuid 컬럼에 넣기 전에 형식을 검사한다. 잘못된 값은 22P02 예외 대신 호출부에서 거절한다.
 * 서버 액션은 직접 POST로도 호출되므로 문자열이 아닌 값도 받아 false를 돌려준다.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}
