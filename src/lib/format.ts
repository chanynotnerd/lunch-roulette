const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 'YYYY-MM-DD' → 'YYYY년 M월 D일'. 형식이 다르면 그대로 돌려준다. 기록 화면 전용. 스펙 15 문구. */
export function formatSlotDate(isoDate: string): string {
  const m = ISO_DATE.exec(isoDate)
  if (!m) return isoDate
  return `${Number(m[1])}년 ${Number(m[2])}월 ${Number(m[3])}일`
}

/** 'N회 방문, 마지막 방문 M월 D일'. 연도는 뺀다(카드가 좁다). 형식이 다르면 날짜 부분에 입력 그대로. 스펙 16 문구. */
export function formatVisitMeta(visits: number, isoDate: string): string {
  const m = ISO_DATE.exec(isoDate)
  const when = m ? `${Number(m[2])}월 ${Number(m[3])}일` : isoDate
  return `${visits}회 방문, 마지막 방문 ${when}`
}
