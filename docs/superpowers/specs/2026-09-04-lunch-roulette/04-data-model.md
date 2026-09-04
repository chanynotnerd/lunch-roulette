# 04. 데이터 모델

[← 인덱스](README.md)

테이블은 5개다. 사용자 테이블은 Supabase Auth의 것을 그대로 쓴다.

## places (장소, 개인 소유)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | 소유자. auth.users 참조 |
| name | text | 예: 회사, 집 |
| address | text | 사용자가 입력한 주소 문자열 |
| lat, lng | double | Geocoding 결과 |
| radius_m | int | 검색 반경(m). 기본 500, 허용 100~2000 |
| created_at | timestamptz | |

제약: (user_id, name) 유일.

## restaurants (식당, 공용 캐시)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| google_place_id | text | 유일. 외부 소스의 장소 식별자. Google 은 place id(`ChIJ…`), 카카오 로컬 API(D17)는 `kakao:<카카오 장소 id>` |
| name | text | |
| address | text | |
| lat, lng | double | |
| hours | jsonb, null 허용 | 요일별 영업시간. 형식은 아래 |
| hours_source | text | google, kakao, default, override, none 중 하나 (마이그레이션 0004). default 는 영업시간을 주지 않는 소스(카카오)에 기본 영업시간을 넣은 행 |
| fetched_at | timestamptz | 마지막 외부 API(Google/카카오) 조회 시각 |

hours가 null이면 hours_source는 none이며 룰렛 후보에서 제외된다. [05-rules.md](05-rules.md)
hours는 null이거나 JSON object여야 한다(check 제약, 마이그레이션 0005).

DB 함수 권한(마이그레이션 0005): public 스키마의 함수는 anon, authenticated, PUBLIC에 EXECUTE가 자동 부여되지 않는다. 브라우저에서 호출해야 하는 함수를 새로 만들면 그 마이그레이션에서 명시적으로 grant한다.

### hours JSON 형식

요일 키는 mon, tue, wed, thu, fri, sat, sun 7개이며 모두 존재해야 한다.
각 요일은 아래 둘 중 하나다.

```json
{ "closed": true }
```

```json
{ "open": "11:00", "close": "21:00", "break": { "start": "15:00", "end": "17:00" } }
```

- 시각은 "HH:MM" 24시간 표기. break는 선택 항목이며 없으면 브레이크 없음.
- close가 open보다 이르면(예: 17:00~02:00) 다음 날 새벽까지 영업으로 해석한다.
- Google이 하루에 영업 구간을 2개 주면 첫 구간 시작을 open, 마지막 구간 끝을 close,
  사이 공백을 break로 변환한다. 구간이 3개 이상이면 첫 번째 공백만 break로 쓴다.
- 24시간 영업은 open "00:00", close "24:00"으로 표기한다.

## place_restaurants (장소-식당 연결)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| place_id | uuid | places 참조. 장소 삭제 시 함께 삭제 |
| restaurant_id | uuid | restaurants 참조 |

PK는 (place_id, restaurant_id). 여러 사용자의 장소가 같은 식당 행을 공유한다.

## roulette_sessions (세션이자 날짜별 기록)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | |
| place_id | uuid, null 허용 | places 참조. 장소 삭제 시 null (on delete set null) |
| slot_date | date | Asia/Seoul 기준 날짜 |
| slot | text | lunch 또는 dinner |
| candidate_ids | uuid[] | 길이 3 |
| reroll_used | bool | 기본 false |
| chosen_restaurant_id | uuid, null 허용 | 확정 전 null |
| status | text | open 또는 confirmed |
| created_at | timestamptz | |
| confirmed_at | timestamptz, null 허용 | |

제약: (user_id, slot_date, slot) 유일. 이 제약이 "슬롯당 세션 1개"를 DB 차원에서 보장한다.
chosen_restaurant_id는 null이거나 candidate_ids 안의 값이어야 한다(check 제약, 마이그레이션 0005). 다시 돌리기와 확정이 경합해도 후보 밖 식당이 확정되지 않는다.
status가 confirmed인 행이 곧 날짜별 기록이다. 기록 테이블은 따로 두지 않는다.
만료는 저장하지 않고 조회 시 판정한다. [05-rules.md](05-rules.md)

## 경험치와 레벨은 저장하지 않는다

- 경험치 = 해당 사용자의 confirmed 세션 중 chosen_restaurant_id가 그 식당인 행의 수.
- 레벨 = 경험치를 레벨 테이블에 대입한 값. 테이블은 [05-rules.md](05-rules.md)에 있다.
- 파생값이므로 "기록과 경험치가 안 맞는" 불일치가 생기지 않는다.
- 확정은 세션 행 하나의 단일 갱신이므로 트랜잭션 함수가 필요 없다.

## 접근 제어 (RLS)

| 테이블 | 읽기 | 쓰기 |
|---|---|---|
| places | 본인 행만 | 서버 액션(서비스 롤) |
| roulette_sessions | 본인 행만 | 서버 액션(서비스 롤) |
| restaurants | 로그인 사용자 전체 | 서버 액션, 시드 스크립트 |
| place_restaurants | 본인 장소에 연결된 행만 | 서버 액션 |

브라우저에서 직접 쓰는 정책은 만들지 않는다. [03-architecture.md](03-architecture.md)
