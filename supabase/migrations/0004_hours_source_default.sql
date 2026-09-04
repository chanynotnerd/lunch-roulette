-- 0004_hours_source_default.sql
-- 카카오 로컬 API 전환(D17): 영업시간을 주지 않는 소스의 식당에 기본 영업시간을 넣고 hours_source='default' 로 표시한다.
alter table public.restaurants
  drop constraint if exists restaurants_hours_source_check;

alter table public.restaurants
  add constraint restaurants_hours_source_check
  check (hours_source in ('google', 'kakao', 'default', 'override', 'none'));
