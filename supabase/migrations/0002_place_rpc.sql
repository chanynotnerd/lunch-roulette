-- 0002_place_rpc.sql
-- 장소 생성(F2): 식당 upsert + 장소 insert + 연결 insert 를 한 트랜잭션으로 수행한다.
-- 테이블 DDL 은 0001_init.sql 에 있다. (스펙 04, 06 F2, 10 override 보호)

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
  r jsonb;
begin
  insert into public.places (user_id, name, address, lat, lng, radius_m)
  values (p_user_id, p_name, p_address, p_lat, p_lng, p_radius_m)
  returning id into v_place_id;

  for r in select value from jsonb_array_elements(coalesce(p_restaurants, '[]'::jsonb))
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
      r->>'hours_source',
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

revoke all on function public.create_place_with_restaurants(uuid, text, text, double precision, double precision, int, jsonb) from public;
grant execute on function public.create_place_with_restaurants(uuid, text, text, double precision, double precision, int, jsonb) to service_role;
