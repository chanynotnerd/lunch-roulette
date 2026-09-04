const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 'YYYY-MM-DD' → 'YYYY년 M월 D일'. 형식이 다르면 그대로 돌려준다. 기록 화면 전용. 스펙 15 문구. */
export function formatSlotDate(isoDate: string): string {
  const m = ISO_DATE.exec(isoDate)
  if (!m) return isoDate
  return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일`
}
