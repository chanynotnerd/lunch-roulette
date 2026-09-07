export type StampMarkerInput = {
  visits: number
  level: number
  name: string
  levelName: string
  selected: boolean
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ESCAPES[ch])
}

/**
 * 도장 마커 HTML. 카카오 CustomOverlay의 content로 쓴다. 스펙 16 시각 디자인 3, 접근성.
 * 숫자는 방문 횟수, 클래스 l1~l5가 크기와 테두리를 정한다. 클릭 처리는 KakaoMap이 붙인다.
 */
export function stampMarkerHtml(input: StampMarkerInput): string {
  const level = Math.min(Math.max(Math.trunc(input.level), 1), 5)
  const cls = `stamp-marker l${level}${input.selected ? ' selected' : ''}`
  const label = escapeHtml(`${input.name}, 레벨 ${level} ${input.levelName}, ${input.visits}회 방문`)
  return `<button type="button" class="${cls}" aria-label="${label}" aria-pressed="${input.selected}">${input.visits}</button>`
}
