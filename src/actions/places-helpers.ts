import { fail, ok, type Result } from '@/lib/result'

/** 장소 액션에서 쓰는 순수 헬퍼. 'use server'가 아니므로 단위 테스트가 가능하다. */

export const NAME_MAX = 50
export const ADDRESS_MAX = 200

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Postgres uuid 컬럼에 넣기 전에 형식을 검사한다. 잘못된 값은 22P02 예외 대신 호출부에서 거절한다. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export type PlaceInput = { name: string; address: string }

/**
 * 장소 생성 입력 검증(스펙 08 INVALID_INPUT). 서버 액션은 직접 POST로도 호출될 수 있으므로
 * 클라이언트 required/maxLength 와 별개로 서버에서 다시 검사한다.
 */
export function validatePlaceInput(input: { name?: unknown; address?: unknown }): Result<PlaceInput> {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (name.length < 1 || name.length > NAME_MAX) return fail('INVALID_INPUT', { field: '이름', max: NAME_MAX })

  const address = typeof input.address === 'string' ? input.address.trim() : ''
  if (address.length < 1 || address.length > ADDRESS_MAX) {
    return fail('INVALID_INPUT', { field: '주소', max: ADDRESS_MAX })
  }

  return ok({ name, address })
}
