# 점심 메뉴 룰렛 설계 스펙 (Source of Truth)

작성일: 2026-09-04
상태: 검토 대기

이 디렉터리는 점심 메뉴 룰렛 프로젝트의 유일한 기획 기준 문서다.
구현 계획과 코드는 이 문서를 따르며, 충돌하면 이 문서가 우선한다.
문서를 고칠 때는 해당 주제 파일 하나만 고치고, 다른 파일은 링크로만 참조한다.

## 문서 인덱스

| 번호 | 파일 | 주제 | 한 줄 요약 |
|---|---|---|---|
| 01 | [01-overview.md](01-overview.md) | 개요 | 목적, 범위, 제외 항목, 기술 스택 |
| 02 | [02-decisions.md](02-decisions.md) | 결정 기록 | 브레인스토밍에서 확정한 결정 18건과 이유 |
| 03 | [03-architecture.md](03-architecture.md) | 아키텍처 | 배포 구성, 책임 분리, 시간 기준 |
| 04 | [04-data-model.md](04-data-model.md) | 데이터 모델 | 테이블 5개, hours JSON, 접근 제어 |
| 05 | [05-rules.md](05-rules.md) | 규칙 | 슬롯, 영업시간 판정, 세션 상태, 레벨 |
| 06 | [06-flows.md](06-flows.md) | 흐름 | 로그인, 장소 생성, 돌리기, 다시 돌리기, 확정, 만료 |
| 07 | [07-screens.md](07-screens.md) | 화면 | 화면 5개와 상태별 표시 |
| 08 | [08-errors.md](08-errors.md) | 오류 처리 | 오류 코드와 사용자 문구 |
| 09 | [09-external-api.md](09-external-api.md) | 외부 API | Google API 사용 범위, 요금, 안전장치 |
| 10 | [10-seed-and-overrides.md](10-seed-and-overrides.md) | 시드와 보정 | 영업시간 보정 파일과 시드 스크립트 |
| 11 | [11-testing.md](11-testing.md) | 테스트 | 테스트 계층과 대상 |
| 12 | [12-pre-implementation-spike.md](12-pre-implementation-spike.md) | 검증 단계 | 구현 전 데이터 품질 스파이크 |
| 13 | [13-backlog.md](13-backlog.md) | 백로그 | 추후 버전에서 작업할 항목 목록 |
| 14 | [14-userflow-happy-case.md](14-userflow-happy-case.md) | 유저플로우 | 해피케이스 시나리오와 다이어그램. Figma(FigJam)의 원본 |
| 15 | [15-visual-design.md](15-visual-design.md) | 시각 디자인 | 단골 도장 카드 컨셉, 토큰, 서체, 레이아웃, 움직임, 접근성 |
| 16 | [16-personal-map.md](16-personal-map.md) | 퍼스널 맵 | 기록 탭 전체 화면 카카오 지도, 식당별 도장 마커, 목록 오버레이. 시각 디자인 구현 이후 작업 |
| 17 | [17-restaurant-search-expansion.md](17-restaurant-search-expansion.md) | 식당 수집 확장 | 카카오 키워드 9개 + 2×2 격자 질의로 45개 벽을 넘김. 장소당 200개 거리순, 반경 상한 1000m |
| 18 | [18-my-page.md](18-my-page.md) | 내 정보 | 하단 탭 4번째 화면. Google 계정 사진·이름·이메일 표시와 로그아웃. DB 변경 없음 |
| 19 | [19-address-search.md](19-address-search.md) | 주소 검색 | 장소 추가 폼의 주소 칸을 카카오 우편번호 서비스(임베드)로 교체. 직접 입력 폴백. 서버·DB 변경 없음 |

## 읽는 순서

- 처음 보는 사람: 01 → 05 → 06 → 07
- 구현하는 사람: 03 → 04 → 05 → 06 → 08 → 11
- 운영/비용 확인: 09 → 10 → 12

## 용어

| 용어 | 뜻 |
|---|---|
| 장소 | 사용자가 등록한 기준 지점. 예: 회사, 집 |
| 식당 | 장소 반경 안에서 검색된 음식점. 공용 데이터 |
| 슬롯 | 하루 두 번의 식사 시간대. lunch, dinner |
| 세션 | 한 슬롯에서 돌리기부터 확정까지의 한 묶음 |
| 후보 | 세션에서 뽑힌 식당 3개 |
| 확정 | 후보 3개 중 1개를 최종 선택하는 행위 |
| 경험치 | 확정된 횟수. 식당별, 사용자별 |
| 레벨 | 경험치를 구간에 대입한 단계. 5단계 |
