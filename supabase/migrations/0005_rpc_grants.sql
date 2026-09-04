-- 0005_rpc_grants.sql
-- 코드리뷰 C1/S2/A2 (docs/superpowers/reviews/2026-09-04-code-review.md)
--
-- 왜 필요한가:
--   0002 의 `revoke all on function ... from public` 은 PUBLIC 의사롤(pseudo-role) 항목만 지운다.
--   Supabase 는 `alter default privileges for role postgres in schema public grant all on functions
--   to anon, authenticated, service_role` 이 기본이라, 함수 생성 시점에 anon/authenticated 에 롤별
--   EXECUTE 가 따로 붙고 그것은 PUBLIC revoke 로 사라지지 않는다. 결과적으로 anon 키만으로
--   SECURITY DEFINER 함수(create_place_with_restaurants)를 호출해 RLS 를 우회할 수 있었다.
--
-- 조치:
--   1) 함수 EXECUTE 를 public/anon/authenticated 에서 명시적으로 회수하고 service_role 에만 부여.
--   2) 앞으로 만들 함수에도 anon/authenticated 가 자동으로 EXECUTE 를 받지 않도록 기본 권한을 변경.
--   3) 심층 방어: 함수 안에서 식당 개수 상한(100) 검사, 입력의 hours_source='override' 거부(default 로 치환).
--      기존 override 행 보호 로직(스펙 10)은 그대로 둔다.
--   4) DB 제약: restaurants.hours 는 null 또는 jsonb object, roulette_sessions.chosen_restaurant_id 는
--      candidate_ids 안의 값이어야 한다(reroll↔confirm 경합 방지).

-- ---------------------------------------------------------------
-- 1) + 3) 함수 재정의 (본문은 0002 기준, 심층 방어 추가)
-- ---------------------------------------------------------------
create or replace function public.create_place_with_restaurants(
  p_user_id uuid,
  p_name text,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_radius_m int,
  p_restaurants jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_place_id uuid;
  v_rid uuid;
  v_restaurants jsonb := coalesce(p_restaurants, '[]'::jsonb);
  r jsonb;
begin
  if jsonb_typeof(v_restaurants) <> 'array' then
    raise exception 'p_restaurants must be a json array';
  end if;
  if jsonb_array_length(v_restaurants) > 100 then
    raise exception 'too many restaurants: % (max 100)', jsonb_array_length(v_restaurants);
  end if;

  insert into public.places (user_id, name, address, lat, lng, radius_m)
  values (p_user_id, p_name, p_address, p_lat, p_lng, p_radius_m)
  returning id into v_place_id;

  for r in select value from jsonb_array_elements(v_restaurants)
  loop
    insert into public.restaurants (
      google_place_id, name, address, lat, lng, hours, hours_source, fetched_at
    ) values (
      r->>'google_place_id',
      r->>'name',
      r->>'address',
      (r->>'lat')::double precision,
      (r->>'lng')::double precision,
      case
        when r->'hours' is null or jsonb_typeof(r->'hours') = 'null' then null
        else r->'hours'
      end,
      -- 입력으로 들어온 override 는 받지 않는다. override 는 시드 스크립트(스펙 10)만 만든다.
      -- hours 가 null 이면 스펙 04 대로 none, 아니면 default 로 낮춘다.
      case
        when r->>'hours_source' = 'override' then
          case
            when r->'hours' is null or jsonb_typeof(r->'hours') = 'null' then 'none'
            else 'default'
          end
        else r->>'hours_source'
      end,
      now()
    )
    on conflict (google_place_id) do update set
      name = excluded.name,
      address = excluded.address,
      lat = excluded.lat,
      lng = excluded.lng,
      fetched_at = now(),
      -- override 행의 hours 는 보호한다. (스펙 10)
      hours = case
        when restaurants.hours_source = 'override' then restaurants.hours
        else excluded.hours
      end,
      hours_source = case
        when restaurants.hours_source = 'override' then 'override'
        else excluded.hours_source
      end
    returning id into v_rid;

    insert into public.place_restaurants (place_id, restaurant_id)
    values (v_place_id, v_rid)
    on conflict do nothing;
  end loop;

  return v_place_id;
end;
$$;

-- ---------------------------------------------------------------
-- 1) 롤별 EXECUTE 회수. create or replace 는 기존 ACL 을 유지하므로 재정의 뒤에 실행한다.
-- ---------------------------------------------------------------
revoke all on function public.create_place_with_restaurants(uuid, text, text, double precision, double precision, int, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_place_with_restaurants(uuid, text, text, double precision, double precision, int, jsonb)
  to service_role;

-- ---------------------------------------------------------------
-- 2) 앞으로 postgres 가 public 스키마에 만드는 함수에는 anon/authenticated/PUBLIC 이 EXECUTE 를 자동으로 받지 않는다.
--    (필요한 함수는 개별 마이그레이션에서 명시적으로 grant 한다.)
-- ---------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------
-- 3) 기존 행 정리. CHECK 제약은 추가 시점에 기존 행을 전부 검사하므로,
--    권한 구멍(위 1)으로 이미 들어왔을 수 있는 비정형 행을 먼저 치운다. 정상 데이터에는 0건이다.
-- ---------------------------------------------------------------
-- hours 가 object 가 아닌 식당: 영업시간 없음으로 되돌린다. (스펙 04: hours null ⇒ hours_source none)
update public.restaurants
  set hours = null, hours_source = 'none'
  where hours is not null and jsonb_typeof(hours) <> 'object';

-- 후보 밖 식당이 확정된 세션(reroll↔confirm 경합, A2): 확정을 풀어 open 으로 되돌린다.
-- 슬롯이 지난 세션은 조회 시 만료로 판정되므로(스펙 05) 되살아나지 않는다.
update public.roulette_sessions
  set chosen_restaurant_id = null, status = 'open', confirmed_at = null
  where chosen_restaurant_id is not null
    and not (chosen_restaurant_id = any(candidate_ids));

-- ---------------------------------------------------------------
-- 4) DB 제약
-- ---------------------------------------------------------------
-- restaurants.hours: null 이거나 jsonb object 여야 한다. (배열/문자열/숫자가 들어오면 isOpenAt 이 닫힘 처리하지만 DB 에서도 막는다)
alter table public.restaurants
  drop constraint if exists restaurants_hours_is_object;

alter table public.restaurants
  add constraint restaurants_hours_is_object
  check (hours is null or jsonb_typeof(hours) = 'object');

-- roulette_sessions.chosen_restaurant_id: 확정 식당은 후보 3개 중 하나여야 한다. (A2)
alter table public.roulette_sessions
  drop constraint if exists roulette_sessions_chosen_in_candidates;

alter table public.roulette_sessions
  add constraint roulette_sessions_chosen_in_candidates
  check (chosen_restaurant_id is null or chosen_restaurant_id = any(candidate_ids));
