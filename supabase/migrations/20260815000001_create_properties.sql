-- properties: mock 房源表（黑客松 MVP）
-- 空间检索使用 PostGIS location 列（由 lat/lng 自动生成）。

create extension if not exists postgis;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rent integer not null,                 -- 月租（日元）
  layout text,                           -- 1K / 1DK / 1LDK / 2LDK ...
  area_m2 numeric(5, 1),                 -- 专有面积（平米）
  address text,
  lat double precision not null,
  lng double precision not null,
  location geography(point, 4326) generated always as (
    st_setsrid(st_makepoint(lng, lat), 4326)::geography
  ) stored,
  nearest_station text,                  -- 最近车站名（例：渋谷）
  walk_minutes integer,                  -- 到最近车站徒步分钟
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists properties_location_gix on public.properties using gist (location);
create index if not exists properties_lat_lng_idx on public.properties (lat, lng);

-- RLS：匿名只读
alter table public.properties enable row level security;

create policy "properties are readable by anyone"
  on public.properties for select
  using (true);

-- 地图 bounds 检索用 RPC（前端 supabase-js: rpc('properties_in_bounds', {...})）
create or replace function public.properties_in_bounds(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
  max_results integer default 200
)
returns setof public.properties
language sql
stable
as $$
  select *
  from public.properties
  where lat between min_lat and max_lat
    and lng between min_lng and max_lng
  order by rent asc
  limit least(max_results, 500);
$$;
