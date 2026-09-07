# 2026-09-07 식당 수집 확장(키워드 분할) 브레인스토밍 준비 문서

새 세션에서 `superpowers:brainstorming`을 바로 시작하기 위한 입력이다. 이 문서는 사실과 열린 질문만 담고, 설계 결정은 브레인스토밍에서 내린다. 결과는 스펙 파일로 남긴다(작업 규칙: brainstorming → 스펙 → writing-plans).

## 새 세션 시작 프롬프트 (복사해서 쓰기)

```
docs/superpowers/handoff/2026-09-07-restaurant-search-expansion-brief.md 를 읽고,
superpowers:brainstorming 으로 "장소 생성 시 식당 수집을 45개 넘게 받도록 카카오 키워드를 나눠 질의하는 기능"을 설계해 줘.
결정이 끝나면 docs/superpowers/specs/2026-09-04-lunch-roulette/ 에 스펙 파일 17을 만들고 README 인덱스와 09, 02(D18), 13 백로그를 갱신해.
```

## 문제 (사실)

- 장소를 만들면 반경 안 식당을 카카오 로컬 API로 한 번 수집한다. 현재 한 장소당 최대 45개만 들어온다.
- 45개 벽은 카카오 규격이다. 키워드 검색은 `size` 최대 15, 한 질의의 노출 가능 문서 수(`meta.pageable_count`) 최대 45. 요청 값을 키워도 넘을 수 없다.
- 현재 질의는 하나뿐이다. `query=음식점`, `category_group_code=FD6`, `x/y`, `radius`, `sort=distance`, `size=15`, `page=1..3`. 거리순이라 반경이 넓은 번화가에서는 가까운 45곳만 들어오고 나머지는 잘린다.
- 사용자와 합의한 방향: **키워드를 여러 개로 나눠 질의하고 id로 합친다.** 비용은 문제가 아니다(카카오 로컬 API는 결제 없음, 일 30만 회 무료).
- 갱신 기능은 없다. 수집은 `createPlace`에서 한 번뿐이고 이후 화면은 DB만 읽는다. 재수집은 백로그 B3(장소 수정)과 얽힌다. 이번 범위에 넣을지는 브레인스토밍에서 정한다.

## 현재 코드 (위치와 동작)

| 파일 | 역할 |
|---|---|
| `src/places/kakao.ts` | 카카오 어댑터. `MAX_PAGES = 3`, `searchRestaurants(center, radiusM)`가 페이지 루프를 돌며 `Map<id, FoundRestaurant>`로 중복 제거, `distanceMeters`로 반경 밖 제거, `meta.is_end`에서 중단. 저장 키는 `kakao:<id>`. 영업시간은 `DEFAULT_HOURS`, `hours_source='default'` |
| `src/places/search.ts` | 공급자 선택(`PLACES_PROVIDER`). 서버 액션은 이 모듈만 import한다. 시그니처 `searchRestaurants(center, radiusM): Promise<FoundRestaurant[]>` |
| `src/places/google.ts` | Google 어댑터. 현재 미사용(B7). 건드리지 않는다 |
| `src/places/types.ts` | `FoundRestaurant`, `LatLng`, `ExternalApiError` |
| `src/places/http.ts` | `fetchExternalJson`(타임아웃, 오류 변환), `finiteNumber`, `isRecord` |
| `src/actions/places.ts:150` | `createPlace`. 장소 수 상한 → 이름 중복 → `geocode` → `searchRestaurants` → RPC `create_place_with_restaurants`. 반경은 100~2000m로 clamp, 기본 500 |
| `supabase/migrations/0002_place_rpc.sql` | RPC. `restaurants`에 `google_place_id` 기준 upsert(override 행의 hours는 보존), `place_restaurants`에 연결 |
| `src/app/(app)/places/PlaceForm.tsx:31` | 결과 문구 "장소를 추가했습니다. 식당 N곳을 찾았습니다." 0곳이면 별도 안내 |
| `tests/places/kakao.test.ts` | 모의 fetch 기반. "최대 3페이지", "2페이지에서 is_end면 중단", 반경·중복 필터 등 12개 케이스. 질의가 여러 개가 되면 `pageParam` 기반 단언이 깨진다 |

관련 스펙: 09(외부 API, 카카오 전환 절), 02 결정표(D15 Google 3페이지, D17 카카오 전환), 04 데이터 모델, 13 백로그(B3 장소 수정, B9 맵 마커 클러스터링, A8 `google_place_id` 컬럼명).

## 카카오 API 제약 (설계에 쓰는 사실)

- 키워드 검색 `/v2/local/search/keyword.json`: `query` 필수, `category_group_code`(FD6 음식점, CE7 카페), `x`/`y`/`radius`(최대 20000m), `rect`(좌하단 x,y, 우상단 x,y 사각형), `page` 1~45, `size` 1~15, `sort` distance|accuracy.
- `radius`와 `rect`는 함께 쓰지 않는다. `rect`를 쓰면 우리 쪽 `distanceMeters` 필터가 반경을 보장한다(이미 있음).
- 응답 `meta`: `total_count`, `pageable_count`(최대 45), `is_end`.
- 같은 식당이 여러 키워드에 걸린다. `id`로 합쳐야 한다(현재 Map 구조 그대로 확장 가능).
- 초당 호출 제한은 공식 문서에 수치가 없다. 병렬 호출 수는 보수적으로 잡고 실제 키로 확인한다.
- 비용 없음. 장소 하나당 호출 수가 10배 늘어도 무료 한도 안이다.

## 브레인스토밍에서 정할 것 (열린 질문)

1. **키워드 목록.** 후보: 한식, 중식, 일식, 양식, 분식, 고기, 국밥, 면, 치킨, 피자, 햄버거, 술집. 어디까지 넣을지, 순서는 어떻게 할지. "음식점" 기본 질의는 유지하는지.
2. **카페 포함 여부.** CE7은 별도 카테고리다. 점심 룰렛 후보로 카페를 넣을지, 넣는다면 디저트 카페와 브런치 카페를 구분할 수 있는지.
3. **분할 방식.** 키워드 분할만 할지, 반경이 클 때(예: 1000m 이상) 격자 `rect` 분할을 섞을지. 키워드 분할은 결과가 카테고리별로 45개씩 잘리는 한계가 남는다.
4. **장소당 식당 수 상한.** 지금은 45가 자연 상한이었다. 수백 개가 되면 장소 상세 목록, 룰렛 후보 풀, 퍼스널 맵 마커(B9)에 영향이 있다. 상한을 둘지, 둔다면 거리순으로 자를지.
5. **호출 방식.** 키워드별 순차 호출이면 지연이 키워드 수 × 최대 3회 왕복. 병렬로 할지, 동시 수를 몇으로 둘지. 일부 키워드 실패 시 전체 실패로 볼지 부분 성공으로 볼지(`ExternalApiError` 처리).
6. **기존 장소 재수집.** 이미 만든 장소는 45개 그대로다. "식당 목록 다시 가져오기" 액션을 이번에 넣을지 B3으로 미룰지. 넣는다면 사라진 식당 처리(기록이 참조하므로 삭제 대신 비활성 표시)와 `place_restaurants` 동기화 규칙.
7. **UI 변화.** 결과 문구 "식당 N곳"은 그대로 둘지. 수집 중 진행 표시가 필요한지(호출이 늘어 몇 초 걸릴 수 있음).
8. **테스트.** `tests/places/kakao.test.ts`의 페이지 단언을 어떻게 바꿀지. 키워드별 모의 응답 설계. 실제 키로 강남역 500m 같은 곳에서 before/after 개수를 재는 스파이크를 할지(스펙 12 방식).
9. **문서.** 스펙 17 신설, 09 카카오 절 수정, 02에 D18 추가, 13 백로그에서 관련 항목 정리, 14 해피케이스는 실제 구현 뒤에만 갱신(작업 규칙).

## 하지 말 것

- `size`나 `MAX_PAGES`를 키우는 것. 카카오 상한 때문에 결과가 늘지 않는다.
- Google 어댑터 수정. 사용하지 않는 경로이고 B7에서 별도로 다룬다.
- 스펙 없이 코드부터 고치는 것. 작업 규칙은 brainstorming → 스펙 → writing-plans 순서다.

## 확인용 명령

```
npm test -- tests/places/kakao.test.ts
npm run build
```

로컬 실행은 `.env.local`의 `KAKAO_REST_API_KEY`와 `PLACES_PROVIDER=kakao`가 필요하다. 테스트 계정과 배포 정보는 `docs/superpowers/handoff/2026-09-04-session-handoff.md`에 있다.
