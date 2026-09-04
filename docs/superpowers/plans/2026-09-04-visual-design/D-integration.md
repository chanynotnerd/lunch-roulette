# 세션 D: 빌드, 스크린샷 검토, 클래스 보충, 문서 갱신

[← 인덱스](README.md). Global Constraints는 인덱스를 따른다. 선행: A, B, C 보고서 3개.

**소유 파일:** `src/app/globals.css`(보충만), 스펙 `07-screens.md`, `13-backlog.md`, `14-userflow-happy-case.md`. A, B, C가 보고한 오류가 그들의 파일에 남아 있으면 그 파일도 고칠 수 있다.

---

### Task D-1: 보고서 반영과 빌드

- [ ] **Step 1: A, B, C 보고서의 "부족한 클래스"를 `globals.css`에 넣는다**

각 항목을 해당 절(버튼, 식권, 폼 등) 끝에 넣는다. 토큰 값은 새로 만들지 않고 `:root`의 변수만 쓴다. 보고된 항목이 없으면 건너뛴다.

- [ ] **Step 2: 남은 인라인 스타일 검사**

Run: `grep -rn "style={{" src/app`
Expected: 결과 0줄. 남아 있으면 그 파일 소유 세션의 계획 코드와 대조해 클래스로 바꾼다.

- [ ] **Step 3: 가운뎃점 검사**

Run: `grep -rn "·" src/app`
Expected: 결과 0줄.

- [ ] **Step 4: 타입 검사, 린트, 테스트, 프로덕션 빌드**

Run: `npx tsc --noEmit; npm run lint; npm test; npm run build`
Expected: 전부 성공. 서체 다운로드 실패면 오류 전문을 보고한다.

---

### Task D-2: 스크린샷 검토 (390px 폭)

- [ ] **Step 1: 개발 서버로 6장 확인**

`/`(세션 없음, open, confirmed 중 현재 가능한 상태), `/places`, `/places/<id>`, `/records`, `/login`. 각 장에서:
- 가로 스크롤이 없다. 긴 식당 이름이 식권 안에서 어절 단위로 줄바꿈된다.
- 빨간색이 화면당 돌리기 버튼, 도장, 현재 탭 밑줄, 도장 5칸 정도에만 쓰였다. 더 있으면 뺀다.
- 표시 서체(Black Han Sans)가 식당 이름, 화면 제목, 장소 선택, 메뉴판에만 쓰였다.
- 그림자 카드, 그라데이션, 눈썹 대문자 라벨이 없다.
- 하단 탭이 본문을 가리지 않는다(페이지 아래 여백이 탭보다 크다).

문제가 있으면 `globals.css`만 고치고 다시 본다. 컴포넌트 구조는 바꾸지 않는다.

- [ ] **Step 2: 스크린샷 저장**

Chrome DevTools 기기 모드(390×844)에서 6장을 `docs/superpowers/reviews/2026-09-04-visual-design/` 아래 `01-home-idle.png`, `02-home-open.png`, `03-home-confirmed.png`, `04-places.png`, `05-records.png`, `06-login.png`로 저장한다. 상태를 만들 수 없는 것은 건너뛰고 보고서에 적는다.

---

### Task D-3: 스펙 갱신

**Files:**
- Modify: `docs/superpowers/specs/2026-09-04-lunch-roulette/07-screens.md`
- Modify: `docs/superpowers/specs/2026-09-04-lunch-roulette/13-backlog.md`
- Modify: `docs/superpowers/specs/2026-09-04-lunch-roulette/14-userflow-happy-case.md`

- [ ] **Step 1: 스펙 07**

S2 표의 "세션 없음(슬롯 안)" 행 표시 칸을 `"영업 중인 식당 3곳을 뽑습니다"`로 바꾼다. S2 open 행의 "레벨 배지"를 "도장 5칸"으로, confirmed 행의 "새 레벨"을 "도장 5칸"으로 바꾼다. S3의 "레벨 배지"도 "도장 5칸"으로. "공통" 절 끝에 한 줄 추가:

```markdown
- 시각 디자인(토큰, 서체, 레이아웃, 움직임, 접근성)은 [15-visual-design.md](15-visual-design.md)를 따른다.
```

- [ ] **Step 2: 스펙 13 백로그**

품질 표에서 Q2 행을 지운다. 코드리뷰 Minor 표에서 U1, U3 행을 지운다. F1은 남긴다(PlacePicker가 spinning을 모르는 것은 이 계획에서 안 고쳤다). 파일 머리의 규칙대로 끝난 항목은 지운다.

- [ ] **Step 3: 스펙 14 유저플로우**

실제 구현된 표현으로 고친다. 규칙: 실제 구현된 동작만 적는다.
- 19행, 26행의 "레벨 배지" → "도장 5칸".
- 44행: `레벨 배지가 "Lv2 익숙", "레벨 업!"이 보인다` → `도장 5칸 중 2칸이 찍힌 "익숙"과 "레벨 업! 이제 익숙입니다"가 보인다`.
- 45행: `오늘 날짜, 점심, 회사, 식당 이름, "Lv2 익숙"이 한 줄로 보인다` → `"2026년 9월 4일 점심, 회사", 식당 이름, 도장 2칸이 찍힌 "익숙"이 보인다`.
- 73행 mermaid: `Lv2 익숙 · 레벨 업!` → `익숙 도장 2칸<br/>레벨 업! 이제 익숙입니다`.
- 77행 mermaid: `날짜 · 점심 · 회사 · OO · Lv2` → `2026년 9월 4일 점심, 회사<br/>OO, 익숙`.

- [ ] **Step 4: 커밋**

```bash
git add src/app/globals.css docs/superpowers/specs/2026-09-04-lunch-roulette/07-screens.md docs/superpowers/specs/2026-09-04-lunch-roulette/13-backlog.md docs/superpowers/specs/2026-09-04-lunch-roulette/14-userflow-happy-case.md docs/superpowers/reviews/2026-09-04-visual-design
git commit -m "docs: 시각 디자인 적용 결과로 스펙 07/13/14 갱신, 스크린샷 추가"
```

`globals.css`를 안 고쳤으면 `git add`에서 뺀다.

- [ ] **Step 5: 보고**

빌드 결과(명령 출력 요약), 스크린샷 파일 목록, 보충한 클래스, 고친 남의 파일, 커밋 해시를 적어 보고한다. 배포는 하지 않는다.
