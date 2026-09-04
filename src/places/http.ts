import { ExternalApiError } from './types'

const TIMEOUT_MS = 8_000
const BODY_SNIPPET_LEN = 200

/**
 * 외부 API 호출 공통 헬퍼.
 * - 8초 타임아웃 (AbortSignal.timeout)
 * - 네트워크 오류·중단은 ExternalApiError 로 바꾼다 (TypeError 가 UNEXPECTED 로 새지 않도록)
 * - 2xx 가 아니면 본문 앞 200자를 담아 ExternalApiError 를 던진다
 * `label` 은 오류 메시지에 들어가므로 API 키나 쿼리 문자열을 넣지 않는다.
 */
export async function fetchExternal(label: string, url: string, init?: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-store', ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (e) {
    const reason = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    throw new ExternalApiError(`${label} request failed (${reason})`)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ExternalApiError(`${label} HTTP ${res.status}: ${body.slice(0, BODY_SNIPPET_LEN)}`, res.status)
  }
  return res
}

/** fetchExternal 뒤에 JSON 본문을 읽는다. 파싱 실패도 ExternalApiError 로 바꾼다. */
export async function fetchExternalJson(label: string, url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetchExternal(label, url, init)
  try {
    return await res.json()
  } catch {
    throw new ExternalApiError(`${label} unexpected response shape (invalid JSON)`)
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** 문자열 또는 숫자를 유한한 number 로. 아니면 null. */
export function finiteNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}
