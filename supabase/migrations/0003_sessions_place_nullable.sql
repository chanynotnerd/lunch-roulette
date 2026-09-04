-- 0003_sessions_place_nullable.sql
-- 장소 삭제(F3): 그 장소를 참조하는 세션은 남기고 place_id 만 null 로 바꾼다.
-- 0001 에서는 place_id 가 not null 이고 FK 에 on delete 절이 없어, 세션이 하나라도 있는 장소는
-- 삭제가 FK 위반(23503)으로 항상 실패했다. (스펙 04 roulette_sessions, 06 F3)

alter table public.roulette_sessions
  alter column place_id drop not null;

alter table public.roulette_sessions
  drop constraint if exists roulette_sessions_place_id_fkey;

alter table public.roulette_sessions
  add constraint roulette_sessions_place_id_fkey
  foreign key (place_id) references public.places(id) on delete set null;
