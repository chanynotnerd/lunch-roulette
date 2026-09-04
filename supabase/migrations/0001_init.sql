-- 0001_init.sql
-- 점심 룰렛 초기 스키마. 스펙 04-data-model.md 기준.
-- 사용자 테이블은 Supabase Auth(auth.users)를 그대로 쓴다.

-- ---------------------------------------------------------------
-- places (장소, 개인 소유)
-- ---------------------------------------------------------------
create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  address     text not null,
  lat         double precision not null,
  lng         double precision not null,
  radius_m    int not null default 500 check (radius_m between 100 and 2000),
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------------------------------------------------------------
-- restaurants (식당, 공용 캐시)
-- hours가 null이면 hours_source는 none이며 룰렛 후보에서 제외된다.
-- ---------------------------------------------------------------
create table if not exists public.restaurants (
  id               uuid primary key default gen_random_uuid(),
  google_place_id  text not null unique,
  name             text not null,
  address          text not null,
  lat              double precision not null,
  lng              double precision not null,
  hours            jsonb,
  hours_source     text not null default 'none'
                   check (hours_source in ('google', 'override', 'none')),
  fetched_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- place_restaurants (장소-식당 연결)
-- ---------------------------------------------------------------
create table if not exists public.place_restaurants (
  place_id       uuid references public.places(id) on delete cascade,
  restaurant_id  uuid references public.restaurants(id) on delete cascade,
  primary key (place_id, restaurant_id)
);

-- ---------------------------------------------------------------
-- roulette_sessions (세션이자 날짜별 기록)
-- (user_id, slot_date, slot) 유일 제약이 "슬롯당 세션 1개"를 보장한다.
-- ---------------------------------------------------------------
create table if not exists public.roulette_sessions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  place_id              uuid not null references public.places(id),
  slot_date             date not null,
  slot                  text not null check (slot in ('lunch', 'dinner')),
  candidate_ids         uuid[] not null check (array_length(candidate_ids, 1) = 3),
  reroll_used           boolean not null default false,
  chosen_restaurant_id  uuid references public.restaurants(id),
  status                text not null default 'open'
                        check (status in ('open', 'confirmed')),
  created_at            timestamptz not null default now(),
  confirmed_at          timestamptz,
  unique (user_id, slot_date, slot)
);

-- 경험치 계산(사용자별 confirmed 세션 중 특정 식당 확정 횟수)용 인덱스
create index if not exists roulette_sessions_user_status_chosen_idx
  on public.roulette_sessions (user_id, status, chosen_restaurant_id);

-- ---------------------------------------------------------------
-- RLS: 읽기만 허용한다. 쓰기는 서비스 롤(서버 액션)로만 수행한다.
-- ---------------------------------------------------------------
alter table public.places            enable row level security;
alter table public.restaurants       enable row level security;
alter table public.place_restaurants enable row level security;
alter table public.roulette_sessions enable row level security;

-- places: 본인 행만
create policy "places_select_own"
  on public.places
  for select
  to authenticated
  using (auth.uid() = user_id);

-- roulette_sessions: 본인 행만
create policy "roulette_sessions_select_own"
  on public.roulette_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

-- restaurants: 로그인 사용자 전체
create policy "restaurants_select_authenticated"
  on public.restaurants
  for select
  to authenticated
  using (true);

-- place_restaurants: 본인 장소에 연결된 행만
create policy "place_restaurants_select_own_place"
  on public.place_restaurants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.places p
      where p.id = place_restaurants.place_id
        and p.user_id = auth.uid()
    )
  );
