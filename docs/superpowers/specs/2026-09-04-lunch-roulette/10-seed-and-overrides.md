# 10. 시드와 보정

[← 인덱스](README.md)

관리 화면(BO)을 만들지 않는 대신, 영업시간 보정은 저장소 안의 파일과 스크립트로 처리한다. (D11)

## 보정 파일

경로: `data/hours-overrides.json`

```json
{
  "ChIJxxxxxxxxxxxx": {
    "note": "OO식당. 2026-09-04 전화 확인",
    "hours": {
      "mon": { "open": "11:00", "close": "21:00", "break": { "start": "15:00", "end": "17:00" } },
      "tue": { "open": "11:00", "close": "21:00", "break": { "start": "15:00", "end": "17:00" } },
      "wed": { "closed": true },
      "thu": { "open": "11:00", "close": "21:00", "break": { "start": "15:00", "end": "17:00" } },
      "fri": { "open": "11:00", "close": "21:00", "break": { "start": "15:00", "end": "17:00" } },
      "sat": { "open": "11:00", "close": "20:00" },
      "sun": { "closed": true }
    }
  }
}
```

- 키는 google_place_id다.
- hours는 [04-data-model.md](04-data-model.md)의 형식을 그대로 따르며, 7개 요일을 모두 적는다. 일부 요일만 보정하는 형식은 두지 않는다.
- note에는 근거와 확인 날짜를 적는다. 스크립트는 note를 저장하지 않는다.

## 시드 스크립트

- 실행: 개발자 로컬에서 `npm run seed:hours`. 서비스 롤 키는 로컬 환경변수에서 읽는다.
- 동작: 보정 파일의 각 항목에 대해 restaurants에서 google_place_id로 행을 찾아 hours를 덮어쓰고 hours_source를 override로 바꾼다.
- 행이 없는 place_id는 건너뛰고 목록으로 출력한다. 아직 어떤 장소에서도 검색되지 않은 식당이기 때문이다.
- 파일의 hours 형식이 잘못되면 아무것도 쓰지 않고 실패한다.

## override 행의 보호

- 장소 생성(F2)에서 같은 식당이 다시 검색되어도 hours_source가 override인 행의 hours는 덮어쓰지 않는다. name, address, fetched_at만 갱신한다.
- override를 해제하려면 보정 파일에서 항목을 지우고 스크립트에 `--reset <place_id>`를 넘긴다. 그러면 hours_source를 google로 되돌리고 다음 장소 생성 때 Google 값이 다시 들어온다.

## 보정 대상 고르기

- 스파이크 결과([12-pre-implementation-spike.md](12-pre-implementation-spike.md))에서 영업시간이 없거나 브레이크타임이 빠진 식당을 우선 조사한다.
- 조사는 웹 검색과 전화 확인으로 하고, 확인 날짜를 note에 남긴다.
