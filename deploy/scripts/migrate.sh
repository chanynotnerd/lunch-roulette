#!/bin/bash
# /migrations/*.sql 을 파일명 순으로 적용한다. 적용한 버전은
# supabase_migrations.schema_migrations 에 기록해 두 번 적용하지 않는다.
# (Supabase CLI가 쓰는 테이블과 같은 이름·컬럼이라 나중에 CLI로 전환해도 이력이 이어진다.)
set -euo pipefail

until pg_isready -q; do
  echo "db 대기 중..."
  sleep 2
done

psql -v ON_ERROR_STOP=1 -q <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version    text primary key,
  statements text[],
  name       text
);
SQL

applied=0
for f in $(ls /migrations/*.sql | sort); do
  base=$(basename "$f" .sql)          # 예: 0001_init
  version=${base%%_*}                 # 예: 0001
  name=${base#*_}                     # 예: init

  exists=$(psql -tA -c "select 1 from supabase_migrations.schema_migrations where version = '$version'")
  if [ "$exists" = "1" ]; then
    echo "건너뜀  $base (이미 적용)"
    continue
  fi

  echo "적용 중 $base"
  psql -v ON_ERROR_STOP=1 -q -1 -f "$f"
  psql -v ON_ERROR_STOP=1 -q -c "insert into supabase_migrations.schema_migrations(version, name) values ('$version', '$name')"
  applied=$((applied + 1))
done

echo "마이그레이션 완료: 새로 적용 ${applied}건"
