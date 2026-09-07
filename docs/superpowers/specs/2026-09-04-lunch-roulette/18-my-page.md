# 18. 내 정보 (마이페이지)

[← 인덱스](README.md)

Google 로그인을 쓰는데 앱 어디에도 누구로 로그인했는지 보이지 않는다. 하단 탭에 "로그아웃" 버튼만 있다.
이 스펙은 다섯 번째 화면 "내 정보"를 만들어 Google 계정의 사진, 이름, 이메일을 보여 주고 로그아웃을 그 안으로 옮긴다.
데이터베이스, 서버 액션, 룰렛 규칙은 바꾸지 않는다.

## 결정 (2026-09-07 브레인스토밍)

| 번호 | 결정 | 이유 |
|---|---|---|
| P1 | 범위는 프로필 표시와 로그아웃까지. 통계, 설정, 회원 탈퇴는 넣지 않는다 | 가장 작은 범위로 "누구로 로그인했는가"를 해결한다. 통계와 탈퇴는 집계 쿼리와 auth.users 삭제 흐름이 따로 필요해 별도 스펙으로 미룬다 |
| P2 | 진입은 하단 탭 4번째 칸 "내 정보". 탭바의 로그아웃 버튼은 없앤다 | 탭바가 이미 "홈·장소·기록·로그아웃" 4칸이라 자리가 있다. 화면 상단 사진은 전체 화면 지도인 기록 탭의 플로팅 버튼과 겹친다 |
| P3 | 프로필은 Supabase Auth가 저장한 Google 메타데이터(`user_metadata`)만 읽는다. 별도 profiles 테이블을 만들지 않는다 | Google 로그인 시 이름, 사진, 이메일이 이미 auth.users에 들어온다. 편집할 항목이 없으니 테이블은 불필요하다. 닉네임·설정이 생기면 그때 만든다(백로그 B10) |
| P4 | 프로필 사진은 next/image 대신 일반 img 태그에 `referrerPolicy="no-referrer"`로 쓴다 | Google 사진 도메인을 next.config에 등록할 필요가 없고, referrer가 붙으면 Google 이미지 서버가 403을 돌려주는 문제를 피한다 |
| P5 | 로그아웃은 확인 단계 없이 바로 실행한다 | 지금 동작과 같다. 다시 로그인하면 되므로 되돌리기 어려운 작업이 아니다 |
| P6 | 관리자 "오늘 기록 초기화" 버튼은 홈·기록에 그대로 둔다 | 이 스펙의 범위 밖. 옮길지는 백로그 O1과 함께 정한다 |

## 화면 S5. 내 정보

경로 `/me`. `(app)` 그룹 안의 서버 컴포넌트다. 위에서부터:

1. 제목 "내 정보" (`.page-title`).
2. 회원증 카드. 스펙 15의 식권 카드(`.ticket`) 어휘를 재사용한다. 왼쪽에 지름 56px 원형 사진, 오른쪽에 이름(표시 서체, `.member-card-name` — `.ticket-name`과 같은 규칙에 `overflow-wrap`을 더한 것)과 이메일(`.member-card-email` — `.ticket-address`와 같은 muted 소문자). 카드는 누를 수 없다(버튼이 아닌 div).
3. 카드 아래 muted 한 줄: "Google 계정으로 로그인되어 있습니다".
4. 로그아웃 버튼. `.btn.btn-block`. 빨간 버튼(`.btn-primary`)은 쓰지 않는다. 스펙 15 "빨간 버튼은 홈의 돌리기 하나뿐".

대체 표시:

| 상황 | 표시 |
|---|---|
| 이름 없음 | 이메일의 `@` 앞부분 |
| 사진 없음(또는 로드 실패) | 이름 첫 글자를 넣은 원. 바탕 paper, 테두리 ink 1.5px, 글자는 표시 서체 |
| 이메일 없음 | 이메일 줄을 비운다. 이름까지 없으면 "사용자" |

레이아웃 예시:

```
┌──────────────────────────┐
│ 내 정보                   │
│ ┌──────────────────────┐ │
│ │ ◯  김찬영             │ │  원형 사진 + 이름(표시 서체)
│ │    user@gmail.com    │ │  이메일(muted)
│ └──────────────────────┘ │
│  Google 계정으로 로그인되어 있습니다 │
│ ┌──────────────────────┐ │
│ │       로그아웃        │ │  .btn.btn-block
│ └──────────────────────┘ │
│  홈    장소    기록   내 정보 │  하단 탭 4칸
└──────────────────────────┘
```

## 하단 탭

스펙 07 공통의 "홈, 장소, 기록"을 "홈, 장소, 기록, 내 정보"로 바꾼다.
`.tabbar`의 열은 `1fr 1fr 1fr auto`에서 `repeat(4, 1fr)`로, 탭바 안의 `<form action={signOut}>`와 `.tabbar-signout` 스타일은 제거한다.
현재 탭 표시(`aria-current="page"`, 빨간 밑줄)는 4번째 탭에도 같은 규칙을 적용한다. 경로 판정은 `pathname.startsWith('/me')`.

## 데이터

### 프로필 읽기

`src/lib/profile.ts` (`server-only`). 순수 함수와 읽기 함수를 나눈다.

```ts
type Profile = {
  name: string          // full_name → name → 이메일 @ 앞 → "사용자"
  email: string | null
  avatarUrl: string | null  // avatar_url → picture → null
  initial: string       // name의 첫 글자(사진 없을 때 원 안에 표시)
}

/** Supabase User(id, email, user_metadata)에서 Profile을 만든다. 순수 함수. */
function toProfile(user: { email?: string | null; user_metadata?: Record<string, unknown> }): Profile

/** 현재 요청의 프로필. 비로그인이면 null. */
async function loadProfile(): Promise<Profile | null>
```

- `toProfile`은 문자열이 아니거나 빈 문자열인 값을 없는 것으로 본다(공백만 있는 이름 포함).
- `loadProfile`은 `createClient().auth.getUser()`를 한 번 부른다. 기존 `requireUser`(`src/lib/auth.ts`)는 그대로 둔다. 서버 액션은 계속 `requireUser`를 쓰고, 화면은 `loadProfile`을 쓴다.
- Google 프로바이더가 `user_metadata`에 넣는 키: `full_name`, `name`, `avatar_url`, `picture`, `email`. 이 다섯 개만 본다.

### 로그아웃

기존 서버 액션 `signOut`(`src/actions/auth.ts`)을 그대로 쓴다. 폼 위치만 탭바에서 내 정보 화면으로 옮긴다.

## 오류

- 비로그인으로 `/me`에 오면 `src/proxy.ts`가 이미 `/login`으로 보낸다. 페이지 안에서 `loadProfile()`이 null이면 한 번 더 `redirect('/login')`한다.
- 사진 로드 실패(`onError`)는 이니셜 원으로 대체한다. 서버 컴포넌트에서는 `onError`를 못 쓰므로 사진과 이니셜을 담는 작은 클라이언트 컴포넌트 `Avatar`로 분리한다.
- 새 오류 코드는 없다.

## 테스트

스펙 11 계층 1(순수 함수)에 `tests/lib/profile.test.ts`를 더한다. `toProfile` 분기:

1. `full_name`과 `avatar_url`이 있으면 그대로.
2. `full_name`이 없고 `name`과 `picture`만 있으면 그 값으로.
3. 이름 키가 모두 없으면 이메일 `@` 앞부분, `initial`은 그 첫 글자.
4. 이름도 이메일도 없으면 `name`은 "사용자", `avatarUrl`은 null.
5. 이름이 공백만이면 없는 것으로 본다.

화면 테스트는 기존 관례(백로그 Q3)대로 두지 않는다. 구현 후 로컬과 프로덕션에서 사진·이름·이메일과 로그아웃을 눈으로 확인한다.

## 문구

스펙 15 문구 표에 아래 두 개를 더한다.

| 위치 | 문구 |
|---|---|
| 내 정보 안내 | Google 계정으로 로그인되어 있습니다 |
| 이름 없음 대체 | 사용자 |

## 다른 문서에 미치는 변경

- [07-screens.md](07-screens.md): S5 추가, 공통 하단 탭 4개.
- [15-visual-design.md](15-visual-design.md): 레이아웃 그림의 하단 탭 줄을 4칸으로.
- [16-personal-map.md](16-personal-map.md): 레이아웃 그림의 하단 탭 줄을 4칸으로.
- [13-backlog.md](13-backlog.md): B10 프로필 테이블·통계·회원 탈퇴 추가.
- [README.md](README.md): 인덱스에 18 추가.

## 제외

- 이름·사진 편집, 닉네임. Google 값을 그대로 쓴다.
- 내 통계(장소 수, 확정 횟수, 레벨별 식당 수). 백로그 B10.
- 회원 탈퇴와 데이터 삭제. 백로그 B10.
- 홈 헤더 인사말("OO님"). 진입점은 탭 하나로 충분하다.
