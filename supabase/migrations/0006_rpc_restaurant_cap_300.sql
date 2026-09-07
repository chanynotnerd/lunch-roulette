-- 0006: create_place_with_restaurants 의 식당 개수 상한 100 → 300 (스펙 17 E4)
--
-- 스펙 17 로 장소당 식당이 거리순 최대 200개가 되었는데, 0005 의 심층 방어 검사가 100개에서
-- 'too many restaurants' 를 던져 createPlace 가 UNEXPECTED 로 실패했다(2026-09-07 로컬 확인).
-- 함수 본문은 0005 와 같고 상한 숫자와 메시지만 바꾼다. ACL 은 create or replace 가 유지하지만
-- 0005 와 같은 revoke/grant 를 다시 실행해 service_role 전용을 보장한다.
-- 앱은 MAX_RESTAURANTS = 200개까지만 보내므로 DB 상한은 여유를 두어 300으로 잡는다.
-- 앱 상한을 올릴 때 DB가 먼저 막지 않게 하기 위함이다.

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
  if jsonb_array_length(v_restaurants) > 300 then
    raise exception 'too many restaurants: % (max 300)', jsonb_array_length(v_restaurants);
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

revoke all on function public.create_place_with_restaurants(uuid, text, text, double precision, double precision, int, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_place_with_restaurants(uuid, text, text, double precision, double precision, int, jsonb)
  to service_role;
