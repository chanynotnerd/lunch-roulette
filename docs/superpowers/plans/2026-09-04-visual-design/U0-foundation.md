# 세션 U0: 기반 (토큰, 서체, CSS 클래스, 레이아웃, 하단 탭, LevelStamps)

[← 인덱스](README.md). Global Constraints는 인덱스를 따른다. **main에서 단독으로, 가장 먼저** 실행하고 커밋한다.

---

### Task U0-1: 토큰, 서체, 모든 컴포넌트 클래스

**Files:**
- Modify: `src/app/globals.css` (전체 교체)
- Modify: `src/app/layout.tsx` (전체 교체)

**Interfaces:**
- Produces: CSS 클래스 이름. A, B, C, D가 이 이름만 쓴다. `page`, `page-title`, `section`, `section-title`, `muted`, `small`, `alert`, `note`, `sr-only`, `back-link`, `btn`, `btn-primary`, `btn-block`, `btn-text`, `btn-admin`, `tabbar`, `tabbar-signout`, `home-top`, `place-select-wrap`, `place-select`, `slot-label`, `board`, `board-name`, `board-caption`, `tickets`, `ticket`, `ticket-main`, `ticket-name`, `ticket-address`, `ticket-stub`, `confirm`, `confirm-actions`, `result`, `result-slot`, `result-name`, `seal`, `is-stamping`, `levelup`, `stamps`, `stamps-compact`, `stamps-row`, `stamp`, `is-on`, `stamps-name`, `stamps-next`, `rows`, `row`, `row-title`, `row-meta`, `stubs`, `stub`, `stub-meta`, `stub-name`, `form`, `field`, `input`, `login`, `login-card`, `login-title`.
- Produces: CSS 변수 `--font-display`, `--font-body`. `layout.tsx`가 next/font 변수 `--font-display-src`, `--font-body-src`를 `<html>`에 붙인다.

- [ ] **Step 1: `src/app/globals.css`를 아래 내용으로 통째로 바꾼다**

```css
/* 스펙 15. 토큰은 여기 한 곳에만 둔다. */
:root {
  --paper: #ffffff;
  --ink: #000000;
  --seal: #d62e2e;
  --seal-deep: #b3201f;
  --muted: #6f6f6f;
  --rule: #e3e3e3;

  --font-display: var(--font-display-src), 'Black Han Sans', sans-serif;
  --font-body: var(--font-body-src), 'IBM Plex Sans KR', system-ui, sans-serif;

  --text-sm: 13px;
  --text-md: 16px;
  --text-lg: 20px;
  --text-xl: 25px;
  --text-2xl: 32px;
  --text-3xl: 40px;

  --tabbar-h: 56px;
}

/* 기본 */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  color-scheme: light;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: var(--text-md);
  line-height: 1.5;
  word-break: keep-all;
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3,
p,
ul {
  margin: 0;
}

ul {
  list-style: none;
  padding: 0;
}

a {
  color: inherit;
}

button,
input,
select {
  font: inherit;
  color: inherit;
}

:focus-visible {
  outline: 3px solid var(--seal);
  outline-offset: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* 페이지 뼈대 */
.page {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 20px calc(var(--tabbar-h) + 32px);
  display: grid;
  gap: 24px;
  align-content: start;
}

.page-title {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: var(--text-xl);
  line-height: 1.2;
}

.section {
  display: grid;
  gap: 12px;
}

.section-title {
  font-size: var(--text-lg);
  font-weight: 700;
  line-height: 1.3;
}

.muted {
  color: var(--muted);
}

.small {
  font-size: var(--text-sm);
}

.alert {
  color: var(--seal);
  font-weight: 500;
}

.note {
  color: var(--seal-deep);
  font-size: var(--text-sm);
}

.back-link {
  font-size: var(--text-sm);
  color: var(--muted);
}

/* 버튼 */
.btn {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  min-height: 48px;
  padding: 0 20px;
  border: 1.5px solid var(--ink);
  border-radius: 4px;
  background: var(--paper);
  color: var(--ink);
  font-weight: 600;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.btn-primary {
  min-height: 56px;
  background: var(--seal);
  border-color: var(--seal);
  color: #fff;
  font-size: var(--text-lg);
}

.btn-primary:not(:disabled):active {
  background: var(--seal-deep);
  border-color: var(--seal-deep);
}

.btn-block {
  width: 100%;
}

.btn-text {
  background: none;
  border: none;
  padding: 4px 0;
  color: var(--muted);
  text-decoration: underline;
  cursor: pointer;
}

.btn-text:disabled {
  opacity: 0.35;
  cursor: default;
}

.btn-admin {
  min-height: 36px;
  padding: 0 12px;
  border-style: dashed;
  border-color: var(--seal);
  color: var(--seal);
  font-size: var(--text-sm);
  justify-self: start;
}

/* 하단 탭 */
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-width: 480px;
  margin: 0 auto;
  min-height: var(--tabbar-h);
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--paper);
  border-top: 1px solid var(--ink);
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  align-items: stretch;
}

.tabbar a {
  position: relative;
  display: grid;
  place-items: center;
  padding: 0 8px;
  color: var(--muted);
  text-decoration: none;
  font-weight: 500;
}

.tabbar a[aria-current='page'] {
  color: var(--ink);
  font-weight: 700;
}

.tabbar a[aria-current='page']::after {
  content: '';
  position: absolute;
  left: 30%;
  right: 30%;
  bottom: 8px;
  height: 3px;
  background: var(--seal);
}

.tabbar form {
  display: grid;
}

.tabbar-signout {
  background: none;
  border: none;
  padding: 0 16px;
  color: var(--muted);
  font-size: var(--text-sm);
  cursor: pointer;
}

/* 홈 상단: 장소 선택 + 슬롯 */
.home-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.place-select-wrap {
  position: relative;
  display: inline-block;
  min-width: 0;
}

.place-select-wrap::after {
  content: '▾';
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: var(--text-lg);
}

.place-select {
  appearance: none;
  -webkit-appearance: none;
  max-width: 100%;
  border: none;
  background: none;
  padding: 0 24px 0 0;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  line-height: 1.1;
  color: var(--ink);
  cursor: pointer;
  text-overflow: ellipsis;
}

.place-select:disabled {
  opacity: 0.5;
  cursor: default;
}

.slot-label {
  font-size: var(--text-lg);
  font-weight: 700;
  white-space: nowrap;
}

/* 메뉴판 */
.board {
  position: relative;
  min-height: 140px;
  padding: 40px 20px;
  border: 3px solid var(--ink);
  display: grid;
  place-items: center;
  text-align: center;
}

.board::before {
  content: '';
  position: absolute;
  inset: 6px;
  border: 1px solid var(--ink);
  pointer-events: none;
}

.board-name {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  line-height: 1.15;
}

.board-caption {
  color: var(--muted);
}

/* 식권 */
.tickets {
  display: grid;
  gap: 12px;
}

.ticket {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto;
  padding: 0;
  border: 1.5px solid var(--ink);
  border-radius: 4px;
  background: var(--paper);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.ticket:disabled {
  cursor: default;
}

.ticket[aria-pressed='true'] {
  border-color: var(--seal);
  box-shadow: inset 0 0 0 2px var(--seal);
}

.ticket-main {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  min-width: 0;
}

.ticket-name {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  line-height: 1.2;
}

.ticket-address {
  color: var(--muted);
  font-size: var(--text-sm);
}

.ticket-stub {
  display: grid;
  place-items: center;
  min-width: 88px;
  padding: 14px 12px;
  border-left: 1.5px dashed var(--ink);
}

/* 확정 확인 */
.confirm {
  display: grid;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--rule);
}

.confirm-actions {
  display: flex;
  gap: 8px;
}

.confirm-actions .btn-primary {
  flex: 1;
}

/* 확정 결과 + 도장 */
.result {
  position: relative;
  display: grid;
  gap: 8px;
  padding: 28px 20px;
  border: 3px solid var(--ink);
}

.result-slot {
  font-weight: 700;
}

.result-name {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: var(--text-3xl);
  line-height: 1.1;
  padding-right: 88px;
}

.seal {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 84px;
  height: 84px;
  border: 3px solid var(--seal);
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-size: var(--text-lg);
  color: var(--seal);
  transform: rotate(-12deg);
  opacity: 0.9;
}

.seal.is-stamping {
  animation: stamp-in 0.32s cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}

@keyframes stamp-in {
  from {
    transform: rotate(-20deg) scale(1.8);
    opacity: 0;
  }
  to {
    transform: rotate(-12deg) scale(1);
    opacity: 0.9;
  }
}

.levelup {
  color: var(--seal);
  font-weight: 700;
}

/* 도장 5칸 */
.stamps {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.stamps-compact {
  flex-direction: column;
  gap: 4px;
}

.stamps-row {
  display: inline-flex;
  gap: 4px;
}

.stamp {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--seal);
  border-radius: 50%;
}

.stamp.is-on {
  background: var(--seal);
}

.stamps-name {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--seal);
}

.stamps-next {
  font-size: var(--text-sm);
  color: var(--muted);
}

/* 장소 목록 (실선 괘선) */
.rows {
  display: grid;
}

.row {
  display: grid;
  gap: 4px;
  padding: 14px 0;
  border-bottom: 1px solid var(--rule);
}

.row:first-child {
  border-top: 1.5px solid var(--ink);
}

.row-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  line-height: 1.2;
  text-decoration: none;
}

.row-title:hover {
  text-decoration: underline;
}

.row-meta {
  color: var(--muted);
  font-size: var(--text-sm);
}

/* 기록 목록 (점선 절취선) */
.stubs {
  display: grid;
}

.stub {
  display: grid;
  gap: 4px;
  padding: 14px 0;
  border-bottom: 1px dashed var(--ink);
}

.stub:first-child {
  border-top: 1.5px solid var(--ink);
}

.stub-meta {
  color: var(--muted);
  font-size: var(--text-sm);
}

.stub-name {
  font-family: var(--font-display);
  font-size: var(--text-lg);
  line-height: 1.2;
}

/* 폼 */
.form {
  display: grid;
  gap: 14px;
}

.field {
  display: grid;
  gap: 6px;
  font-weight: 500;
}

.input {
  width: 100%;
  padding: 12px;
  border: 1.5px solid var(--ink);
  border-radius: 4px;
  background: var(--paper);
}

.input:disabled {
  opacity: 0.5;
}

/* 로그인 */
.login {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 360px;
  display: grid;
  gap: 20px;
  text-align: center;
}

.login-title {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: var(--text-3xl);
  line-height: 1.1;
}

/* 움직임 끄기 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 2: `src/app/layout.tsx`를 아래 내용으로 바꾼다**

```tsx
import type { Metadata, Viewport } from 'next'
import { Black_Han_Sans, IBM_Plex_Sans_KR } from 'next/font/google'
import './globals.css'

// 스펙 15. subsets는 preload 대상만 정한다. 한글 조각은 unicode-range로 필요할 때 내려받는다.
const display = Black_Han_Sans({ weight: '400', subsets: ['latin'], variable: '--font-display-src', display: 'swap' })
const body = IBM_Plex_Sans_KR({ weight: ['400', '500', '700'], subsets: ['latin'], variable: '--font-body-src', display: 'swap' })

export const metadata: Metadata = {
  title: '식사 룰렛',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: 타입 검사와 린트**

Run: `npx tsc --noEmit; npm run lint`
Expected: 둘 다 오류 0. (next/font는 빌드·개발 서버 시작 시 Google Fonts에 접속한다. 네트워크가 막혀 실패하면 오류 전문을 보고하고 멈춘다. 대체 경로를 임의로 만들지 않는다.)

- [ ] **Step 4: 개발 서버로 서체 확인**

Run: `npm run dev` 후 브라우저에서 `http://localhost:3000/login` 열기.
Expected: 페이지가 뜨고 DevTools의 Computed 탭에서 body의 font-family가 `__IBM_Plex_Sans_KR_`로 시작한다. 화면 스타일은 아직 옛 모습이어도 된다.

---

### Task U0-2: (app) 라우트 그룹 레이아웃과 하단 탭

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Modify: `src/app/components/Nav.tsx` (전체 교체)
- Modify: `src/app/(app)/page.tsx`, `src/app/(app)/places/page.tsx`, `src/app/(app)/places/[id]/page.tsx`, `src/app/(app)/records/page.tsx` (`<main>`과 `<Nav />` 제거, import 경로 수정만)

**Interfaces:**
- Consumes: Task U0-1의 `page`, `tabbar`, `tabbar-signout` 클래스.
- Produces: 페이지 컴포넌트는 `<main>` 없이 프래그먼트(`<>…</>`)로 자식만 돌려준다. A, B, C가 이 전제로 페이지를 다시 쓴다.

- [ ] **Step 1: `src/app/(app)/layout.tsx` 생성**

```tsx
import Nav from '@/app/components/Nav'

/** 홈, 장소, 기록 공통 뼈대. 로그인은 이 그룹 밖이다. 스펙 07 공통. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="page">{children}</main>
      <Nav />
    </>
  )
}
```

- [ ] **Step 2: `src/app/components/Nav.tsx`를 아래 내용으로 바꾼다**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/actions/auth'

const TABS = [
  { href: '/', label: '홈' },
  { href: '/places', label: '장소' },
  { href: '/records', label: '기록' },
] as const

/** 하단 탭: 홈, 장소, 기록 + 로그아웃. 현재 화면은 aria-current로 표시한다. 스펙 07 공통, 15 접근성. */
export default function Nav() {
  const pathname = usePathname()
  const isCurrent = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <nav className="tabbar" aria-label="주요 화면">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={isCurrent(t.href) ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
      <form action={signOut}>
        <button type="submit" className="tabbar-signout">
          로그아웃
        </button>
      </form>
    </nav>
  )
}
```

- [ ] **Step 3: 네 페이지의 뼈대만 맞춘다**

각 파일에서 `<main …>`을 `<>`로, `</main>`을 `</>`로 바꾸고 `<Nav />` 줄과 `Nav` import 줄을 지운다. 본문 스타일은 A, B, C가 바꾸므로 여기서는 손대지 않는다.

`src/app/(app)/page.tsx`는 상대 경로 import를 절대 경로로 바꾸고 `mainStyle` 상수를 지운다. 오류 분기(`if (!places.ok)`) 안의 `<main style={mainStyle}>`도 `<>`로 바꾼다.

```tsx
import Nav from './components/Nav'                       // 삭제
import AdminResetButton from './components/AdminResetButton'  // → from '@/app/components/AdminResetButton'
import PlacePicker from './components/PlacePicker'       // → from '@/app/components/PlacePicker'
import RouletteBoard from './components/RouletteBoard'   // → from '@/app/components/RouletteBoard'
```

`src/app/(app)/places/page.tsx`, `src/app/(app)/places/[id]/page.tsx`는 `import Nav from '@/app/components/Nav'` 줄을 지운다. `src/app/(app)/records/page.tsx`는 `import Nav from '../components/Nav'`와 `import AdminResetButton from '../components/AdminResetButton'`을 각각 지우고 `import AdminResetButton from '@/app/components/AdminResetButton'`로 바꾼다.

- [ ] **Step 4: 타입 검사, 린트, 화면 확인**

Run: `npx tsc --noEmit; npm run lint`
Expected: 오류 0.

브라우저: `/`, `/places`, `/records` 이동. 하단 탭이 한 번만 보이고, 현재 화면 탭이 검은 굵은 글씨에 빨간 밑줄. 로그아웃이 동작한다.

---

### Task U0-3: LevelStamps 컴포넌트

**Files:**
- Create: `src/app/components/LevelStamps.tsx`

**Interfaces:**
- Consumes: `LEVELS` (`src/config/levels.ts`, `{ level, name, xp }[]` 5개). Task U0-1의 `stamps*` 클래스.
- Produces: `LevelStamps({ level: number; levelName: string; nextIn: number | null; compact?: boolean })`. `compact`면 세로 배치에 "다음 레벨까지"를 숨긴다(식권 절취선 영역용). A, B, C가 쓴다.

- [ ] **Step 1: 파일 생성**

```tsx
import { LEVELS } from '@/config/levels'

type Props = {
  level: number
  levelName: string
  nextIn: number | null
  /** 식권 절취선 영역용. 세로 배치, "다음 레벨까지" 숨김. */
  compact?: boolean
}

/** 레벨을 도장 5칸으로 보여 준다. 찍힌 칸 수가 레벨이다. 스펙 15. */
export default function LevelStamps({ level, levelName, nextIn, compact = false }: Props) {
  const label = `레벨 ${level} ${levelName}${nextIn !== null ? `, 다음 레벨까지 ${nextIn}회` : ''}`
  return (
    <span className={compact ? 'stamps stamps-compact' : 'stamps'} role="img" aria-label={label}>
      <span className="stamps-row" aria-hidden="true">
        {LEVELS.map((l) => (
          <span key={l.level} className={l.level <= level ? 'stamp is-on' : 'stamp'} />
        ))}
      </span>
      <span className="stamps-name" aria-hidden="true">
        {levelName}
      </span>
      {!compact && nextIn !== null && (
        <span className="stamps-next" aria-hidden="true">
          다음 레벨까지 {nextIn}회
        </span>
      )}
    </span>
  )
}
```

- [ ] **Step 2: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 오류 0.

- [ ] **Step 3: 커밋 (U0 전체를 한 번에)**

```bash
git add src/app/globals.css src/app/layout.tsx "src/app/(app)" src/app/components/Nav.tsx src/app/components/LevelStamps.tsx docs/superpowers/specs/2026-09-04-lunch-roulette/15-visual-design.md docs/superpowers/specs/2026-09-04-lunch-roulette/README.md docs/superpowers/plans/2026-09-04-visual-design docs/superpowers/handoff/2026-09-04-visual-design-handoff.md .claude/agents/ui-a-home.md .claude/agents/ui-b-places.md .claude/agents/ui-c-records-login.md .claude/agents/ui-d-integration.md
git commit -m "feat(ui): 디자인 토큰, 서체, (app) 레이아웃, LevelStamps 기반 (스펙 15)"
```

(`git mv`로 옮긴 파일들은 stage에 이미 rename으로 잡혀 있다. 이 커밋에 포함된다. 기존 미커밋 변경 42개는 건드리지 않는다.)

U0 커밋 해시를 A, B, C 에이전트 프롬프트에 적어 준다.
