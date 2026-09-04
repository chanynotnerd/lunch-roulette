import { DAY_KEYS } from '@/rules/types'
import type { DayHours, Hours } from '@/rules/types'

/**
 * hours JSON 형식 검증 (스펙 04, 10). 순수 함수, I/O 없음.
 *
 * - validateHours: 보정 파일·시드용 엄격 검증. 오류 문구 목록을 돌려준다(빈 배열이면 유효).
 *   휴무일은 {closed:true} 만 허용, 알 수 없는 키 거부, open === close 거부,
 *   break 는 open~close 안(자정 넘김이면 open~24:00 안)이고 start < end 여야 한다.
 * - isDayHoursShape: 런타임(isOpenAt)용 느슨한 형식 검사. 예외 없이 계산할 수 있는 모양인지만 본다.
 */

/** "HH:MM". 00:00~23:59 와 24:00 만 허용한다(24:01~24:59 거부). 시드·보정 파일용. */
export const TIME_RE = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/

/**
 * 런타임용 느슨한 "HH:MM". 24:01~24:59 도 받는다.
 * 0005 이전 시드 정규식이 그 범위를 허용했으므로 이미 DB 에 들어간 override 행의 판정이 바뀌지 않게 한다.
 */
const LOOSE_TIME_RE = /^(?:[01]\d|2[0-4]):[0-5]\d$/

const DAY_OPEN_KEYS = ['open', 'close', 'break']
const BREAK_KEYS = ['start', 'end']

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isTime(v: unknown): v is string {
  return typeof v === 'string' && TIME_RE.test(v)
}

function isLooseTime(v: unknown): v is string {
  return typeof v === 'string' && LOOSE_TIME_RE.test(v)
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * 런타임용 느슨한 형식 검사. closed === true 이면 휴무, 아니면 open/close(및 break) 가 "HH:MM" 이어야 한다.
 * closed:false 나 알 수 없는 키는 허용한다(무시).
 */
export function isDayHoursShape(day: unknown): day is DayHours {
  if (!isPlainObject(day)) return false
  if (day.closed === true) return true
  if (!isLooseTime(day.open) || !isLooseTime(day.close)) return false
  if (day.break !== undefined) {
    if (!isPlainObject(day.break)) return false
    if (!isLooseTime(day.break.start) || !isLooseTime(day.break.end)) return false
  }
  return true
}

function validateDay(day: unknown, path: string, errors: string[]): void {
  if (!isPlainObject(day)) {
    errors.push(`${path}: 객체가 아닙니다`)
    return
  }
  if ('closed' in day) {
    if (day.closed !== true) {
      errors.push(`${path}.closed: 휴무일은 {"closed": true} 만 허용합니다 (${String(day.closed)})`)
      return
    }
    const extra = Object.keys(day).filter((k) => k !== 'closed')
    if (extra.length) errors.push(`${path}: closed 와 함께 다른 키(${extra.join(', ')})가 있습니다`)
    return
  }

  const unknown = Object.keys(day).filter((k) => !DAY_OPEN_KEYS.includes(k))
  if (unknown.length) errors.push(`${path}: 알 수 없는 키(${unknown.join(', ')})`)

  let ok = true
  if (!isTime(day.open)) {
    errors.push(`${path}.open: "HH:MM" 형식이 아닙니다 (${String(day.open)})`)
    ok = false
  }
  if (!isTime(day.close)) {
    errors.push(`${path}.close: "HH:MM" 형식이 아닙니다 (${String(day.close)})`)
    ok = false
  }
  if (!ok) return

  const o = minutes(day.open as string)
  const c = minutes(day.close as string)
  if (o === c) {
    errors.push(`${path}: open 과 close 가 같습니다 (${day.open})`)
    return
  }

  if (day.break === undefined) return
  if (!isPlainObject(day.break)) {
    errors.push(`${path}.break: 객체가 아닙니다`)
    return
  }
  const extra = Object.keys(day.break).filter((k) => !BREAK_KEYS.includes(k))
  if (extra.length) errors.push(`${path}.break: 알 수 없는 키(${extra.join(', ')})`)
  let breakOk = true
  if (!isTime(day.break.start)) {
    errors.push(`${path}.break.start: "HH:MM" 형식이 아닙니다 (${String(day.break.start)})`)
    breakOk = false
  }
  if (!isTime(day.break.end)) {
    errors.push(`${path}.break.end: "HH:MM" 형식이 아닙니다 (${String(day.break.end)})`)
    breakOk = false
  }
  if (!breakOk) return

  const bs = minutes(day.break.start as string)
  const be = minutes(day.break.end as string)
  if (bs >= be) {
    errors.push(`${path}.break: start 가 end 보다 이르지 않습니다 (${day.break.start}~${day.break.end})`)
    return
  }
  // 자정 넘김(close < open)이면 브레이크는 open~24:00 안에만 둘 수 있다. 자정 이후 브레이크는 표현하지 않는다(스펙 05).
  const upper = c > o ? c : 24 * 60
  if (bs < o || be > upper) {
    errors.push(
      `${path}.break: 영업시간(${day.open}~${c > o ? day.close : '24:00'}) 밖입니다 (${day.break.start}~${day.break.end})`,
    )
  }
}

/** 엄격 검증. 오류가 없으면 빈 배열. path 는 오류 문구 앞에 붙는 접두(예: "kakao:123.hours"). */
export function validateHours(value: unknown, path = 'hours'): string[] {
  const errors: string[] = []
  if (!isPlainObject(value)) {
    errors.push(`${path}: 객체가 아닙니다`)
    return errors
  }
  for (const key of DAY_KEYS) {
    if (!(key in value)) {
      errors.push(`${path}.${key}: 요일이 빠졌습니다`)
      continue
    }
    validateDay(value[key], `${path}.${key}`, errors)
  }
  const unknown = Object.keys(value).filter((k) => !(DAY_KEYS as readonly string[]).includes(k))
  if (unknown.length) errors.push(`${path}: 알 수 없는 요일 키(${unknown.join(', ')})`)
  return errors
}

export function isValidHours(value: unknown): value is Hours {
  return validateHours(value).length === 0
}
