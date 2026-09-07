# 09. 외부 API

[← 인덱스](README.md)

외부 API는 장소 생성(F2)에서만 호출한다. 돌리기, 다시 돌리기, 확정, 조회는 DB만 읽는다.
호출은 서버 액션에서만 하며 키는 Vercel 환경변수에만 둔다. [03-architecture.md](03-architecture.md)

## 사용하는 호출

| 용도 | API | SKU 등급 | 장소 생성 1건당 호출 수 |
|---|---|---|---|
| 주소 → 좌표 | Geocoding API | Essentials | 1회 |
| 주변 식당 + 영업시간 | Places API (New) Text Search | Enterprise | 최대 3회(페이지당 20개, 3페이지) |

- Text Search를 쓰는 이유: Nearby Search는 요청당 20개 상한에 다음 페이지가 없다. (D15)
- 영업시간 필드(regularOpeningHours)를 요청하면 Enterprise 등급으로 과금된다. 이름과 주소만 받으면 Pro지만 영업시간이 필수이므로 Enterprise 기준으로 계산한다.
- 요청 필드는 id, displayName, formattedAddress, location, regularOpeningHours로 제한한다. 그 외 필드는 요청하지 않는다.
- 검색 조건: 장소 좌표를 중심으로 radius_m 반경, 유형은 restaurant, 언어는 ko.

## 요금 (2026-09 확인)

2025년 3월부터 월 200달러 공용 크레딧 대신 SKU별 무료 호출 수가 적용된다.

| SKU | 월 무료 한도 | 초과 시(0~10만 구간) |
|---|---|---|
| Geocoding (Essentials) | 10,000회 | 1,000회당 약 5달러 |
| Text Search (Enterprise) | 1,000회 | 1,000회당 약 35달러 |

- 장소 생성 1건 = Geocoding 1회 + Text Search 최대 3회. 월 300건 이하의 장소 생성은 0원이다.
- 요금은 변할 수 있으므로 구현 시 Google 공식 요금표를 다시 확인한다.

## 청구 차단 안전장치 (필수)

1. Google Cloud 콘솔에서 Places API 일일 할당량을 30회, Geocoding API를 30회로 제한한다. 한도에 닿으면 과금 대신 호출이 실패하고 앱은 EXTERNAL_API_UNAVAILABLE을 보여 준다.
2. 예산 알림을 1달러로 설정해 이상 징후를 메일로 받는다.
3. API 키에 API 제한(Geocoding, Places만)을 건다.
4. Places API(New)는 결제 계정 등록이 있어야 활성화된다. 등록은 필요하지만 위 장치로 실제 청구를 막는다.

## 알려진 한계

- Google의 국내 소규모 식당 영업시간 커버리지는 네이버보다 낮다. 영업시간이 없는 식당은 후보에서 빠지므로(D14) 후보 풀이 검색 결과보다 작아진다.
- 브레이크타임은 더 자주 비어 있다. 보정 파일로 메운다. [10-seed-and-overrides.md](10-seed-and-overrides.md)
- 이 한계의 실제 크기는 구현 전 스파이크로 측정한다. [12-pre-implementation-spike.md](12-pre-implementation-spike.md)

## 출처

- Google Maps Platform SKU 상세: https://developers.google.com/maps/billing-and-pricing/sku-details
- Text Search (New) 문서: https://developers.google.com/maps/documentation/places/web-service/text-search
- Nearby Search (New) 문서(20개 상한 확인): https://developers.google.com/maps/documentation/places/web-service/nearby-search

## 2026-09-04 전환: 카카오 로컬 API (D17)

- 검색 소스는 `PLACES_PROVIDER` 환경변수로 고른다. `kakao` 또는 `google`. 미설정이면 `KAKAO_REST_API_KEY`가 있을 때 kakao.
- 카카오 호출: 주소 → 좌표는 `/v2/local/search/address.json`(없으면 keyword 검색), 식당은 `/v2/local/search/keyword.json`에 `category_group_code=FD6`, `sort=distance`, 페이지당 15개, 질의당 최대 3페이지(45개). 질의는 키워드 9개와 반경 500m 초과 시 2×2 `rect` 격자로 나눠 여러 번 호출하고 id로 합친다. 장소당 최대 호출 108회, 저장은 거리순 200개까지. 세부는 [17-restaurant-search-expansion.md](17-restaurant-search-expansion.md) (D18).
- 카카오 할당량: 앱당 일 300,000회 무료, 결제 수단 등록 없음. 넘으면 429가 오고 앱은 EXTERNAL_API_UNAVAILABLE을 보여 준다. 과금은 발생하지 않는다.
- 인증은 `Authorization: KakaoAK <REST API 키>` 헤더. 결제 등록이 필요 없고 일 30만 회 무료.
- 카카오는 영업시간을 제공하지 않는다. 식당은 `src/config/default-hours.ts`의 기본 영업시간으로 저장되고 hours_source는 `default`다. 정확한 시간은 보정 파일로 덮어쓴다(스펙 10). 마이그레이션 0004가 hours_source 허용값에 kakao, default를 추가한다.
- google_place_id 컬럼에는 `kakao:<id>` 형식으로 저장한다. 컬럼 이름은 바꾸지 않는다.
