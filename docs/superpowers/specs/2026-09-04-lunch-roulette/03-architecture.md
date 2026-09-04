# 03. 아키텍처

[← 인덱스](README.md)

## 배포 구성

- Next.js 앱 하나를 Vercel에 배포한다. 화면과 서버 액션이 같은 코드베이스에 있다.
- Supabase가 Postgres DB, Google 로그인(Auth), 행 단위 보안(RLS)을 담당한다.
- Google Geocoding API와 Places Text Search API는 서버 액션에서만 호출한다.
  API 키는 Vercel 환경변수에만 둔다. 브라우저에 노출되는 키는 없다.

## 책임 분리

| 계층 | 하는 일 | 하지 않는 일 |
|---|---|---|
| 화면(클라이언트) | 장소 선택, 룰렛 애니메이션, 후보 표시, 버튼, 기록과 레벨 표시 | 규칙 판단, DB 쓰기 |
| 서버 액션 | 장소 생성, 돌리기, 다시 돌리기, 확정. 모든 규칙 판단 | 화면 렌더링 |
| DB(Postgres) | 저장, 유일 제약, RLS 읽기 제한 | 비즈니스 규칙 |
| 시드 스크립트(로컬) | 보정 파일을 식당 테이블에 반영 | 앱 런타임 참여 |

규칙 판단을 서버에만 두는 이유: 브라우저에서 판단하면 개발자 도구로 세션 잠금을 우회하거나
경험치를 올릴 수 있다. 규칙은 [05-rules.md](05-rules.md), 흐름은 [06-flows.md](06-flows.md)를 따른다.

## 쓰기 경로

- 모든 쓰기는 서버 액션이 서비스 롤 키로 수행한다.
- 서버 액션은 먼저 요청자의 로그인 사용자 id를 확인하고, 그 id로 소유권을 검사한 뒤 쓴다.
- 브라우저에서 Supabase에 직접 쓰는 경로는 없다. RLS는 읽기 제한만 담당한다.

## 시간 기준

- 슬롯 판정, 영업시간 비교, "오늘"의 경계는 모두 서버에서 Asia/Seoul 기준으로 계산한다.
- 사용자 기기의 시계는 신뢰하지 않는다. 클라이언트는 시각을 서버에 보내지 않는다.
- 시간을 다루는 함수는 현재 시각을 인자로 받는다. 테스트 편의를 위해서다. [11-testing.md](11-testing.md)

## 모듈 경계

| 모듈 | 책임 | 의존 |
|---|---|---|
| rules/slot | 현재 시각 → 슬롯 또는 없음 | 없음 |
| rules/hours | 식당 hours JSON + 현재 시각 → 영업 중 여부 | 없음 |
| rules/level | 경험치 → 레벨 | 레벨 테이블 설정 |
| places/search | 주소 → 좌표, 좌표 → 식당 목록(hours 포함) | Google API. 교체 가능해야 함 |
| actions/* | 서버 액션. 위 모듈을 조합 | Supabase, rules, places |

places/search는 [12-pre-implementation-spike.md](12-pre-implementation-spike.md) 결과에 따라
소스를 바꿀 수 있도록, 다른 모듈이 Google 응답 형식을 직접 알지 못하게 한다.
