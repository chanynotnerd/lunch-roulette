import { describe, it, expect } from 'vitest'
import { ADDRESS_MAX, MAX_PLACES_PER_USER, NAME_MAX, checkPlaceLimit, isUuid, validatePlaceInput } from '@/actions/places-helpers'

describe('isUuid', () => {
  it('정상 UUID v4 형식은 true', () => {
    expect(isUuid('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true)
    expect(isUuid('3F2504E0-4F89-41D3-9A0C-0305E82C3301')).toBe(true)
  })

  it.each(['abc', '', '3f2504e0-4f89-41d3-9a0c', '3f2504e0-4f89-41d3-9a0c-0305e82c3301x', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'])(
    '%j 는 false',
    (v) => {
      expect(isUuid(v)).toBe(false)
    },
  )
})

describe('validatePlaceInput', () => {
  it('앞뒤 공백을 제거한 이름과 주소를 돌려준다', () => {
    const r = validatePlaceInput({ name: '  회사 ', address: ' 서울시 강남구 테헤란로 1 ' })
    expect(r).toEqual({ ok: true, data: { name: '회사', address: '서울시 강남구 테헤란로 1' } })
  })

  it('이름이 비어 있으면 INVALID_INPUT (field: 이름)', () => {
    const r = validatePlaceInput({ name: '   ', address: '서울시 강남구' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('INVALID_INPUT')
    expect(r.params).toEqual({ field: '이름', max: NAME_MAX })
  })

  it('이름이 최대 길이를 넘으면 INVALID_INPUT', () => {
    const r = validatePlaceInput({ name: 'a'.repeat(NAME_MAX + 1), address: '서울시 강남구' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('INVALID_INPUT')
    expect(r.params?.field).toBe('이름')
  })

  it('이름이 정확히 최대 길이면 통과', () => {
    const r = validatePlaceInput({ name: 'a'.repeat(NAME_MAX), address: '서울시 강남구' })
    expect(r.ok).toBe(true)
  })

  it('주소가 비어 있으면 INVALID_INPUT (field: 주소)', () => {
    const r = validatePlaceInput({ name: '회사', address: '' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('INVALID_INPUT')
    expect(r.params).toEqual({ field: '주소', max: ADDRESS_MAX })
  })

  it('주소가 최대 길이를 넘으면 INVALID_INPUT', () => {
    const r = validatePlaceInput({ name: '회사', address: 'a'.repeat(ADDRESS_MAX + 1) })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.params?.field).toBe('주소')
  })

  it('문자열이 아닌 값(직접 POST)도 INVALID_INPUT 으로 거절한다', () => {
    const r = validatePlaceInput({ name: undefined, address: 123 })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.code).toBe('INVALID_INPUT')
  })
})

describe('checkPlaceLimit', () => {
  it('상한 미만이면 통과', () => {
    expect(checkPlaceLimit(0)).toEqual({ ok: true, data: null })
    expect(checkPlaceLimit(MAX_PLACES_PER_USER - 1).ok).toBe(true)
  })

  it('상한에 닿거나 넘으면 PLACE_LIMIT (max 포함)', () => {
    const r = checkPlaceLimit(MAX_PLACES_PER_USER)
    expect(r).toEqual({ ok: false, code: 'PLACE_LIMIT', params: { max: MAX_PLACES_PER_USER } })
    expect(checkPlaceLimit(MAX_PLACES_PER_USER + 5).ok).toBe(false)
  })

  it('숫자가 아니면(count null 등 방어) 거절한다', () => {
    expect(checkPlaceLimit(NaN).ok).toBe(false)
  })
})
