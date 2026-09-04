import { fail, ok, type Result } from '@/lib/result'

/** 장소 액션에서 쓰는 순수 헬퍼. 'use server'가 아니므로 단위 테스트가 가능하다. */

export const NAME_MAX = 50
export const ADDRESS_MAX = 200

/** 사용자당 장소 수 상한. 개방형 가입 + 외부 API 호출 비용을 막는다(리뷰 S1). */
export const MAX_PLACES_PER_USER = 10

export { isUuid } from '@/lib/uuid'

/** 현재 장소 수로 새 장소를 만들 수 있는지. 상한에 닿았으면 PLACE_LIMIT. */
export function checkPlaceLimit(currentCount: number): Result<null> {
  if (!Number.isFinite(currentCount) || currentCount >= MAX_PLACES_PER_USER) {
    return fail('PLACE_LIMIT', { max: MAX_PLACES_PER_USER })
  }
  return ok(null)
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
