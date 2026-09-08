# 19. 주소 검색 (카카오 우편번호 서비스)

[← 인덱스](README.md)

장소 추가 폼의 주소 칸은 자유 문자열이다. 사용자가 오타를 내거나 "회사 앞"처럼 주소가 아닌 말을 넣으면 저장 시점에야 실패를 알거나(GEOCODE_NOT_FOUND), 더 나쁘게는 서버의 키워드 폴백이 엉뚱한 좌표를 잡는다(백로그 U4).
이 스펙은 주소 칸을 카카오 우편번호 서비스(구 Daum Postcode)로 바꿔 사용자가 검색해서 고른 정규화된 도로명 주소만 들어오게 한다.
데이터베이스, 서버 액션, 지오코딩, 식당 수집은 바꾸지 않는다.

## 결정 (2026-09-08 브레인스토밍)

| 번호 | 결정 | 이유 |
|---|---|---|
| A1 | 카카오 우편번호 서비스를 쓴다. 카카오 로컬 REST API의 주소 검색을 클라이언트에서 직접 부르지 않는다 | 우편번호 서비스는 키 발급, 도메인 등록, 호출 제한이 모두 없고 검색 UI까지 제공한다. 로컬 API로 자동완성을 만들면 키 노출 또는 서버 프록시가 필요하다 |
| A2 | 팝업이 아니라 폼 안에 펼치는 임베드(`embed`) 방식 | 모바일 웹에서 팝업은 차단되거나 새 탭으로 튀어 폼 상태를 잃는다. 임베드는 폼 안에서 끝난다 |
| A3 | 저장하는 주소는 `roadAddress`, 없으면 `jibunAddress`. 건물명·우편번호는 저장하지 않는다 | 서버 지오코딩(`/v2/local/search/address.json`)은 도로명 주소를 가장 정확히 찾는다. places.address 열은 그대로 쓰고 새 열을 만들지 않는다 |
| A4 | "직접 입력" 폴백을 남긴다 | 신축 건물이나 검색이 안 되는 곳, 스크립트 로드 실패에 대비한다. 서버는 어느 경로로 왔는지 구분하지 않으므로 서버 변경이 없다 |
| A5 | 서버의 주소→키워드 폴백(U4)은 이 스펙에서 건드리지 않는다 | 직접 입력 경로가 남아 있으므로 폴백이 아직 필요하다. 검색 경로가 기본이 되면 오타 주소 자체가 줄어 U4의 실질 위험이 낮아진다 |
| A6 | 스크립트는 카카오 CDN에서 불러온다. 셀프호스팅 번들에 넣지 않는다 | 이용 약관이 스크립트 수정을 금지한다. 카카오맵 SDK도 같은 방식으로 외부에서 받으므로 새 제약이 아니다 |

## 화면 S3. 장소 관리, 주소 칸

스펙 07의 "장소 추가 폼: 이름, 주소, 반경"에서 주소 칸만 바뀐다. 이름과 반경은 그대로다.

기본 상태(검색 모드):

```
주소
┌──────────────────────────┐
│ 주소 검색을 눌러 주세요     │  읽기 전용. 고른 주소가 여기 표시된다
└──────────────────────────┘
[ 주소 검색 ]          직접 입력   .btn + .btn-text
```

"주소 검색"을 누르면 버튼 아래에 검색 영역이 펼쳐진다:

```
주소
┌──────────────────────────┐
│ 주소 검색을 눌러 주세요     │
└──────────────────────────┘
[ 검색 닫기 ]          직접 입력
┌──────────────────────────┐
│                          │
│  카카오 우편번호 서비스     │  너비 100%, 높이 400px(서비스 최소값)
│  (iframe)                │  하단 카카오 로고는 가리지 않는다(약관)
│                          │
└──────────────────────────┘
```

주소를 고르면 검색 영역이 닫히고(`autoClose`) 읽기 전용 칸에 주소가 채워진다. 다시 "주소 검색"을 누르면 새로 고를 수 있다.

직접 입력 모드("직접 입력"을 누른 뒤):

```
주소
┌──────────────────────────┐
│ 도로명 주소               │  지금과 같은 텍스트 입력
└──────────────────────────┘
                     주소 검색   .btn-text. 누르면 검색 모드로 돌아간다
```

모드를 바꿔도 이미 들어 있는 주소 문자열은 유지한다. 검색 모드로 돌아갈 때 직접 입력한 문자열이 읽기 전용 칸에 그대로 보인다.

제출 후 성공하면 지금처럼 이름·주소·반경을 비우고, 모드는 검색 모드로 돌아간다.

### 상태별 표시

| 상황 | 표시 |
|---|---|
| 스크립트 로드 중에 "주소 검색"을 누름 | 버튼 문구 "불러오는 중…", 비활성. 로드가 끝나면 바로 펼친다 |
| 스크립트 로드 실패(오류 또는 10초 초과) | 직접 입력 모드로 자동 전환. 칸 아래 muted 한 줄 "주소 검색을 불러오지 못했습니다. 직접 입력해 주세요". "주소 검색" 버튼은 숨긴다 |
| 제출 중(`pending`) | 읽기 전용 칸, 버튼, 텍스트 입력 모두 비활성. 검색 영역이 열려 있었으면 닫는다 |
| 검색 모드에서 주소가 비어 있는 채로 제출 | 브라우저 `required` 검증이 읽기 전용 칸에 걸리도록 hidden이 아닌 readOnly input을 쓴다. 문구는 브라우저 기본값 |

## 구성 요소

### `AddressField` (클라이언트 컴포넌트)

`src/app/(app)/places/AddressField.tsx`. `PlaceForm`의 주소 `<label>` 블록을 통째로 대체한다.

```ts
type Props = {
  value: string
  onChange: (address: string) => void
  disabled: boolean
}
```

책임:

- 스크립트 로드. `next/script`로 `https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js`를 `afterInteractive`로 넣고 `onLoad`/`onError`를 받는다. 10초 타이머는 KakaoMap의 `INIT_TIMEOUT_MS`와 같은 방식.
- 모드 상태 `'search' | 'manual'`, 검색 영역 열림 여부, 로드 상태 `'loading' | 'ready' | 'failed'`.
- 검색 영역을 열 때 `new window.daum.Postcode({ oncomplete, onclose, width: '100%', height: '100%' }).embed(container, { autoClose: true })`. 컨테이너는 `ref`로 잡은 `div`, 높이 400px.
- `oncomplete`에서 `pickAddress(data)` 결과를 `onChange`로 올린다. `onclose`에서 열림 상태를 닫는다.
- `PlaceForm`은 `address` 상태를 지금처럼 들고 있고, 이 컴포넌트에 `value`/`onChange`만 넘긴다. 서버 액션 호출은 바뀌지 않는다.

### `pickAddress` (순수 함수)

`src/app/(app)/places/address-helpers.ts`. TDD 대상.

```ts
type PostcodeData = {
  roadAddress?: string
  jibunAddress?: string
  address?: string
  userSelectedType?: 'R' | 'J'
}

/** 저장할 주소 문자열. roadAddress → jibunAddress → address 순서. 앞뒤 공백 제거. 전부 비면 빈 문자열. */
function pickAddress(data: PostcodeData): string
```

`userSelectedType`은 읽지 않는다. 사용자가 지번으로 검색했더라도 `roadAddress`가 있으면 도로명을 저장한다(A3).

### 타입 선언

`src/types/daum-postcode.d.ts`. `window.daum.Postcode` 생성자, `embed(element, options)`, `oncomplete` 데이터에서 이 스펙이 쓰는 필드만 선언한다. `kakao-maps.d.ts`와 같은 방식.

## 데이터 흐름

1. 사용자가 "주소 검색"을 누른다. 스크립트가 준비되어 있으면 검색 영역을 펼친다.
2. 카카오 iframe 안에서 검색하고 항목을 고른다. `oncomplete(data)`가 온다.
3. `pickAddress(data)`로 문자열을 만들어 `PlaceForm`의 `address`에 넣는다. 검색 영역은 닫힌다.
4. 제출하면 지금처럼 `createPlace({ name, address, radiusM })`. 서버는 스펙 06 흐름 그대로 `validatePlaceInput` → 지오코딩 → 식당 수집 → 저장.

서버가 받는 것은 문자열 하나뿐이다. 우편번호 서비스가 준 좌표는 없으므로(서비스가 좌표를 주지 않는다) 지오코딩은 지금처럼 서버가 한다.

## 오류 처리

| 상황 | 처리 |
|---|---|
| 스크립트 로드 실패 | 직접 입력 모드로 전환, 안내 한 줄. 새 오류 코드는 만들지 않는다(서버 오류가 아니다) |
| 카카오 서비스 장애로 iframe 안이 비어 있음 | 사용자가 "검색 닫기" 후 "직접 입력"으로 넘어간다. 별도 감지는 하지 않는다 |
| 고른 주소를 서버가 못 찾음 | 지금과 같은 GEOCODE_NOT_FOUND 문구. 도로명 주소라면 사실상 발생하지 않는다 |
| `pickAddress`가 빈 문자열 | 읽기 전용 칸이 비어 있으므로 `required`에 걸려 제출되지 않는다 |

스펙 08의 오류 코드 표는 바뀌지 않는다.

## 외부 의존

| 항목 | 값 |
|---|---|
| 스크립트 | `https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js` |
| 키 | 불필요 |
| 호출 제한 | 없음. 상업 이용 무료 |
| 약관 | 하단 카카오 로고를 가리거나 지우지 않는다. 스크립트를 수정하지 않는다. 인터넷 연결이 필요하다(사내망 미지원) |
| 셀프호스팅 영향 | 없음. 브라우저가 카카오 CDN에 직접 접속한다. Docker 이미지, Cloudflare Tunnel 설정 변경 없음 |

스펙 09 외부 API 표에는 "주소 검색 UI: 카카오 우편번호 서비스, 키 없음, 무료, 호출 제한 없음" 한 줄을 더한다.

## 테스트

스펙 11의 계층을 따른다.

| 계층 | 대상 |
|---|---|
| 단위(vitest) | `pickAddress`: roadAddress 우선, jibunAddress 폴백, address 폴백, 공백 제거, 전부 없으면 빈 문자열 |
| 수동 | 검색으로 고른 주소로 장소 생성 성공. 직접 입력 경로로 장소 생성 성공. 스크립트 URL을 막은 상태(브라우저 개발자 도구 차단)에서 직접 입력으로 자동 전환. 모바일 폭(390px)에서 검색 영역이 폼 안에 들어가고 가로 스크롤이 없음 |

`AddressField` 자체는 iframe과 외부 스크립트에 묶여 있어 단위 테스트하지 않는다. KakaoMap과 같은 기준.

## 바꾸는 파일

| 파일 | 변경 |
|---|---|
| `src/app/(app)/places/address-helpers.ts` | 새 파일. `pickAddress`와 `PostcodeData` |
| `src/app/(app)/places/address-helpers.test.ts` | 새 파일 |
| `src/app/(app)/places/AddressField.tsx` | 새 파일 |
| `src/app/(app)/places/PlaceForm.tsx` | 주소 `<label>` 블록을 `AddressField`로 교체. 성공 후 초기화는 그대로 |
| `src/types/daum-postcode.d.ts` | 새 파일 |
| `src/app/globals.css` | 검색 영역 컨테이너 클래스 하나(`.address-search`: 높이 400px, 테두리 ink 1.5px, 모서리 4px, `.input`과 같은 어휘). 버튼 행은 기존 `.btn`/`.btn-text`로 충분하면 추가하지 않는다 |
| `docs/.../07-screens.md` | S3 장소 추가 폼 줄에 "주소는 카카오 우편번호 검색, 직접 입력 폴백" 추가, 19 링크 |
| `docs/.../06-flows.md` | 장소 생성 1단계에 "주소는 검색으로 고르거나 직접 입력" 한 줄, 19 링크 |
| `docs/.../09-external-api.md` | 우편번호 서비스 한 줄 |
| `docs/.../13-backlog.md` | U4에 "19 적용 후 검색 경로에서는 발생하지 않음. 직접 입력 경로만 남음" 메모 |
| `docs/.../14-userflow-happy-case.md` | 구현·확인 뒤에만 갱신 |

바꾸지 않는 것: 데이터베이스, 마이그레이션, `src/actions/*`, `src/places/*`, 스펙 04·05·08.

## 제외

- 주소 자동완성(타이핑 중 제안). 우편번호 서비스가 검색 UI를 제공하므로 불필요.
- 장소 수정(백로그 B3). 수정 폼이 생기면 같은 `AddressField`를 재사용한다.
- 우편번호·건물명·지번 저장. 필요해지면 열을 추가하는 별도 스펙.
- 서버 키워드 폴백 제거(U4). A5.
