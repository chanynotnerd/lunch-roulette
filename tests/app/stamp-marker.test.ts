import { describe, expect, it } from 'vitest'
import { placeMarkerHtml, stampMarkerHtml } from '@/app/(app)/records/stamp-marker'

const base = { visits: 7, level: 4, name: '김밥천국', levelName: '찐단골', selected: false }

describe('stampMarkerHtml', () => {
  it('button 하나에 레벨 클래스, 방문 횟수 숫자, 접근성 라벨을 넣는다', () => {
    const html = stampMarkerHtml(base)
    expect(html).toBe(
      '<button type="button" class="stamp-marker l4" aria-label="김밥천국, 레벨 4 찐단골, 7회 방문" aria-pressed="false">7</button>',
    )
  })

  it('레벨 1~5는 l1~l5 클래스', () => {
    for (const level of [1, 2, 3, 4, 5]) {
      expect(stampMarkerHtml({ ...base, level })).toContain(`class="stamp-marker l${level}"`)
    }
  })

  it('레벨이 범위를 벗어나면 1~5로 자른다', () => {
    expect(stampMarkerHtml({ ...base, level: 0 })).toContain('l1"')
    expect(stampMarkerHtml({ ...base, level: 9 })).toContain('l5"')
  })

  it('선택되면 selected 클래스와 aria-pressed="true"', () => {
    const html = stampMarkerHtml({ ...base, selected: true })
    expect(html).toContain('class="stamp-marker l4 selected"')
    expect(html).toContain('aria-pressed="true"')
  })

  it('식당 이름의 HTML 특수문자를 이스케이프한다', () => {
    const html = stampMarkerHtml({ ...base, name: '<b>"김밥" & 분식\'</b>' })
    expect(html).not.toContain('<b>')
    expect(html).toContain('aria-label="&lt;b&gt;&quot;김밥&quot; &amp; 분식&#39;&lt;/b&gt;, 레벨 4 찐단골, 7회 방문"')
  })
})

describe('placeMarkerHtml', () => {
  it('검은 점과 이름 라벨을 가진 누를 수 없는 마커. 접근성 라벨은 "장소 {이름}"', () => {
    expect(placeMarkerHtml({ name: '회사' })).toBe(
      '<div class="place-marker" role="img" aria-label="장소 회사"><span class="place-marker-dot"></span><span class="place-marker-name">회사</span></div>',
    )
  })

  it('이름의 HTML 특수문자를 이스케이프한다', () => {
    const html = placeMarkerHtml({ name: '<b>집</b> & "본가"' })
    expect(html).not.toContain('<b>')
    expect(html).toContain('aria-label="장소 &lt;b&gt;집&lt;/b&gt; &amp; &quot;본가&quot;"')
    expect(html).toContain('<span class="place-marker-name">&lt;b&gt;집&lt;/b&gt; &amp; &quot;본가&quot;</span>')
  })
})
