# 06. 흐름

[← 인덱스](README.md)

규칙의 정의는 [05-rules.md](05-rules.md), 오류 코드는 [08-errors.md](08-errors.md)를 따른다.

## F1. 로그인

1. 비로그인 상태는 로그인 화면만 보인다. Google 로그인 버튼 하나.
2. 로그인 후 장소가 하나도 없으면 장소 관리 화면으로, 있으면 홈으로 이동한다.
3. 세션이 만료되면 서버 액션이 AUTH_REQUIRED를 돌려주고 화면은 로그인으로 보낸다.

## F2. 장소 생성

1. 사용자가 이름, 주소, 반경(기본 500m)을 입력한다.
2. 서버 액션이 로그인 사용자를 확인하고, 같은 이름의 장소가 있으면 PLACE_NAME_DUPLICATE로 거절한다.
3. Geocoding으로 주소를 좌표로 바꾼다. 결과가 없으면 GEOCODE_NOT_FOUND. 저장하지 않는다.
4. Text Search로 반경 안의 음식점을 최대 3페이지(60개) 가져온다. [09-external-api.md](09-external-api.md)
5. 각 식당의 영업시간을 hours JSON으로 변환한다. 영업시간이 없으면 hours는 null, hours_source는 none.
6. 식당을 google_place_id 기준으로 upsert한다. 기존 행의 hours_source가 override이면 hours를 덮어쓰지 않는다.
7. 장소 행과 place_restaurants 연결을 저장한다. 식당 저장과 장소 저장은 한 트랜잭션이다.
8. 식당이 0개면 장소는 저장하되 화면에 PLACE_NO_RESTAURANTS 안내를 띄운다.
9. API 할당량 초과나 호출 실패는 EXTERNAL_API_UNAVAILABLE로 거절하고 아무것도 저장하지 않는다.

## F3. 장소 삭제

- 본인 장소만 삭제할 수 있다. 연결(place_restaurants)만 지우고 식당 행은 남긴다.
- 그 장소를 참조하는 세션은 남긴다. 기록 화면에는 장소 이름 대신 "삭제된 장소"로 표시한다.

## F4. 돌리기

1. 사용자가 장소를 고르고 돌리기를 누른다.
2. 서버가 현재 시각으로 슬롯을 판정한다. 슬롯 없음이면 OUTSIDE_SLOT과 다음 슬롯 시각을 돌려준다.
3. 오늘 이 슬롯의 세션이 이미 있으면 새로 만들지 않고 그 세션을 돌려준다. open이면 후보 화면, confirmed면 결과 화면으로 이어진다.
4. 장소가 본인 것이 아니면 PLACE_FORBIDDEN.
5. 장소에 연결된 식당 중 영업 중인 식당으로 후보 풀을 만든다.
6. 후보 풀이 3개 미만이면 NOT_ENOUGH_OPEN과 현재 개수를 돌려준다. 세션을 만들지 않는다.
7. 3개를 뽑아 open 세션을 저장하고, 후보 3개와 후보 풀 이름 목록을 돌려준다.
8. 클라이언트는 후보 풀 이름으로 애니메이션을 재생한 뒤 후보 3개를 보여 준다. 결과는 이미 서버에서 정해져 있다.

동시 요청: 돌리기를 두 번 빠르게 누르면 유일 제약 때문에 두 번째 삽입이 실패한다.
서버 액션은 그 경우 기존 세션을 다시 읽어 돌려준다.

## F5. 다시 돌리기

1. 세션이 open이 아니면 SESSION_NOT_OPEN. reroll_used가 true면 REROLL_ALREADY_USED.
2. F4의 5~7을 다시 수행해 candidate_ids를 교체하고 reroll_used를 true로 바꾼다.
3. 후보 풀이 3개 미만이면 NOT_ENOUGH_OPEN. 이때 기존 후보와 reroll_used는 그대로 둔다.

## F6. 확정

1. 세션이 open이 아니면 SESSION_NOT_OPEN. 고른 식당이 candidate_ids에 없으면 NOT_A_CANDIDATE.
2. chosen_restaurant_id, confirmed_at을 채우고 status를 confirmed로 바꾼다. 갱신 조건에 status = open을 포함한다.
3. 응답에 확정 식당, 새 경험치, 새 레벨, 레벨업 여부를 담는다.

## F7. 만료

- 별도 배치 없음. 슬롯 끝 시각이 지난 open 세션은 조회 시 expired로 취급한다.
- expired 세션은 기록 목록에 나오지 않고 경험치에도 반영되지 않는다.
- 다음 슬롯이나 다음 날에는 새 세션을 만들 수 있다. 유일 제약은 날짜와 슬롯이 다르므로 충돌하지 않는다.

## F8. 기록과 레벨 조회

- 기록: 본인의 confirmed 세션을 slot_date, slot 내림차순으로. 날짜, 슬롯, 장소, 식당, 확정 당시 레벨.
- 확정 당시 레벨은 "그 세션 이전까지의 확정 횟수 + 1"을 레벨 테이블에 대입해 계산한다.
- 식당 목록: 장소별 식당과 레벨 배지, 다음 레벨까지 남은 횟수. hours가 null이면 "영업시간 정보 없음".
