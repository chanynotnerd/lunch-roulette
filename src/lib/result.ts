export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'PLACE_NAME_DUPLICATE'
  | 'GEOCODE_NOT_FOUND'
  | 'PLACE_NO_RESTAURANTS'
  | 'EXTERNAL_API_UNAVAILABLE'
  | 'PLACE_FORBIDDEN'
  | 'OUTSIDE_SLOT'
  | 'NOT_ENOUGH_OPEN'
  | 'SESSION_NOT_OPEN'
  | 'REROLL_ALREADY_USED'
  | 'NOT_A_CANDIDATE'
  | 'INVALID_INPUT'
  | 'UNEXPECTED'

export type Ok<T> = { ok: true; data: T }
export type Fail = { ok: false; code: ErrorCode; params?: Record<string, string | number> }
export type Result<T> = Ok<T> | Fail

export const ok = <T>(data: T): Ok<T> => ({ ok: true, data })
export const fail = (code: ErrorCode, params?: Record<string, string | number>): Fail => ({ ok: false, code, params })

export const ERROR_MESSAGES: Record<ErrorCode, (p?: Record<string, string | number>) => string> = {
  AUTH_REQUIRED: () => '로그인이 필요합니다',
  PLACE_NAME_DUPLICATE: () => '같은 이름의 장소가 이미 있습니다',
  GEOCODE_NOT_FOUND: () => '주소를 찾을 수 없습니다. 도로명 주소로 다시 입력해 주세요',
  PLACE_NO_RESTAURANTS: () => '근처에서 식당을 찾지 못했습니다. 반경을 늘려 보세요',
  EXTERNAL_API_UNAVAILABLE: () => '지금은 장소를 만들 수 없습니다. 잠시 후 다시 시도해 주세요',
  PLACE_FORBIDDEN: () => '접근할 수 없는 장소입니다',
  OUTSIDE_SLOT: (p) => `다음 룰렛은 ${p?.time ?? ''}에 열립니다`,
  NOT_ENOUGH_OPEN: (p) => `지금 영업 중인 식당이 ${p?.count ?? 0}곳뿐입니다`,
  SESSION_NOT_OPEN: () => '이미 확정된 룰렛입니다',
  REROLL_ALREADY_USED: () => '다시 돌리기는 한 번만 가능합니다',
  NOT_A_CANDIDATE: () => '후보에 없는 식당입니다',
  INVALID_INPUT: (p) => `${p?.field ?? '입력값'}은(는) 1~${p?.max ?? ''}자로 입력해 주세요`,
  UNEXPECTED: () => '알 수 없는 오류가 발생했습니다',
}
