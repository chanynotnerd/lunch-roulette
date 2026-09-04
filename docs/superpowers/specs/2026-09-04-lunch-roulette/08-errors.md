# 08. 오류 처리

[← 인덱스](README.md)

서버 액션은 실패 시 아래 코드 중 하나를 돌려준다. 화면은 코드에 대응하는 문구를 보여 준다.
원인 없는 "오류가 발생했습니다"는 쓰지 않는다.

## 오류 코드

| 코드 | 발생 지점 | 저장 여부 | 사용자 문구 |
|---|---|---|---|
| AUTH_REQUIRED | 모든 서버 액션 | 없음 | 로그인이 필요합니다 (로그인 화면으로 이동) |
| PLACE_NAME_DUPLICATE | F2 | 없음 | 같은 이름의 장소가 이미 있습니다 |
| GEOCODE_NOT_FOUND | F2 | 없음 | 주소를 찾을 수 없습니다. 도로명 주소로 다시 입력해 주세요 |
| PLACE_NO_RESTAURANTS | F2 | 장소는 저장 | 근처에서 식당을 찾지 못했습니다. 반경을 늘려 보세요 |
| EXTERNAL_API_UNAVAILABLE | F2 | 없음 | 지금은 장소를 만들 수 없습니다. 잠시 후 다시 시도해 주세요 |
| PLACE_FORBIDDEN | F3, F4 | 없음 | 접근할 수 없는 장소입니다 |
| OUTSIDE_SLOT | F4 | 없음 | 다음 룰렛은 HH:MM에 열립니다 |
| NOT_ENOUGH_OPEN | F4, F5 | 없음 | 지금 영업 중인 식당이 N곳뿐입니다 |
| SESSION_NOT_OPEN | F5, F6 | 없음 | 이미 확정된 룰렛입니다 |
| REROLL_ALREADY_USED | F5 | 없음 | 다시 돌리기는 한 번만 가능합니다 |
| NOT_A_CANDIDATE | F6 | 없음 | 후보에 없는 식당입니다 |
| INVALID_INPUT | F2 | 없음 | {field}은(는) 1~{max}자로 입력해 주세요 (서버 액션은 직접 POST로도 호출되므로 서버에서 다시 검사) |

흐름 번호는 [06-flows.md](06-flows.md)를 가리킨다.

## 응답 형식

- 성공: `{ ok: true, data }`
- 실패: `{ ok: false, code, params }`. params에는 문구에 들어갈 값(HH:MM, N, field, max)을 담는다.
- 예외를 던지지 않고 값으로 돌려준다. 예상하지 못한 예외만 로깅 후 UNEXPECTED로 바꿔 돌려준다.

## 부분 저장 방지

- F2에서 식당 upsert, 장소 저장, 연결 저장은 한 트랜잭션이다. 중간 실패 시 아무것도 남지 않는다.
- F4에서 세션 삽입이 유일 제약으로 실패하면 오류가 아니라 기존 세션을 돌려준다.

## Google API 할당량 초과

- 할당량 초과 응답은 EXTERNAL_API_UNAVAILABLE로 통일한다. 사용자에게 할당량이라는 말은 보여 주지 않는다.
- 서버 로그에는 원인을 남긴다. [09-external-api.md](09-external-api.md)
