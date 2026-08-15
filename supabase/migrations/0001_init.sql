-- Souseki commute housing search: initial schema
create extension if not exists postgis;

-- Rental listings (demo data is clearly flagged via is_demo)
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  external_id text unique not null,
  title text not null,
  description text,
  property_name text,
  address text not null,
  prefecture text,
  city text,
  district text,
  latitude double precision not null,
  longitude double precision not null,
  geom geography(point, 4326) generated always as (
    st_setsrid(st_makepoint(longitude, latitude), 4326)::geography
  ) stored,
  monthly_rent integer not null,
  management_fee integer not null default 0,
  deposit integer not null default 0,
  key_money integer not null default 0,
  layout text,
  floor_area numeric(6, 2) not null,
  building_age integer not null default 0,
  built_year integer,
  floor_number integer,
  total_floors integer,
  structure_type text,
  nearest_station_name text,
  walk_minutes_to_station integer,
  railway_line text,
  image_urls text[] default '{}',
  source_name text,
  source_url text,
  is_available boolean not null default true,
  pets_allowed boolean not null default false,
  furnished boolean not null default false,
  bath_toilet_separate boolean not null default false,
  auto_lock boolean not null default false,
  delivery_box boolean not null default false,
  parking_available boolean not null default false,
  bicycle_parking boolean not null default false,
  internet_free boolean not null default false,
  air_conditioner boolean not null default false,
  balcony boolean not null default false,
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_geom_idx on public.listings using gist (geom);
create index if not exists listings_rent_idx on public.listings (monthly_rent);
create index if not exists listings_available_idx on public.listings (is_available);

-- Geocoded workplace/place candidates cache
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  name text not null,
  address text not null,
  place_type text not null default 'poi',
  prefecture text,
  latitude double precision not null,
  longitude double precision not null,
  provider text not null,
  created_at timestamptz not null default now()
);
create index if not exists places_query_idx on public.places (query);

-- Third-party commute route cache (server-side, written by Edge Functions)
create table if not exists public.commute_cache (
  cache_key text primary key,
  origin_lat double precision not null,
  origin_lng double precision not null,
  dest_lat double precision not null,
  dest_lng double precision not null,
  mode text not null,
  arrival_bucket text not null,
  provider text not null,
  is_estimated boolean not null default false,
  result jsonb not null,
  computed_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists commute_cache_expires_idx on public.commute_cache (expires_at);

-- Isochrone cache
create table if not exists public.isochrone_cache (
  cache_key text primary key,
  center_lat double precision not null,
  center_lng double precision not null,
  mode text not null,
  time_limit_minutes integer not null,
  provider text not null,
  is_estimated boolean not null default false,
  polygon jsonb not null,
  computed_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Demo station network (optional server-side copy)
create table if not exists public.stations (
  id text primary key,
  name text not null,
  operator text,
  line text,
  latitude double precision not null,
  longitude double precision not null
);

create table if not exists public.station_edges (
  id bigint generated always as identity primary key,
  from_station text not null references public.stations (id),
  to_station text not null references public.stations (id),
  minutes integer not null,
  line text not null,
  is_transfer boolean not null default false
);

-- Per-user data
create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  params jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.listing_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  file_path text not null,
  status text not null default 'pending',
  total_rows integer,
  imported_rows integer,
  error_rows jsonb,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

-- RLS
alter table public.listings enable row level security;
alter table public.places enable row level security;
alter table public.commute_cache enable row level security;
alter table public.isochrone_cache enable row level security;
alter table public.stations enable row level security;
alter table public.station_edges enable row level security;
alter table public.favorites enable row level security;
alter table public.saved_searches enable row level security;
alter table public.listing_import_jobs enable row level security;

-- Public read-only reference data
create policy "listings are publicly readable"
  on public.listings for select using (true);
create policy "stations are publicly readable"
  on public.stations for select using (true);
create policy "station edges are publicly readable"
  on public.station_edges for select using (true);
create policy "places are publicly readable"
  on public.places for select using (true);

-- Caches are only touched by Edge Functions using the service role
-- (service role bypasses RLS; no anon policies on purpose).

-- Per-user rows
create policy "users manage own favorites"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "users manage own saved searches"
  on public.saved_searches for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "users read own import jobs"
  on public.listing_import_jobs for select
  using (auth.uid() = user_id);

-- Radius prefilter RPC used by the frontend (layer 1 of the search)
create or replace function public.search_listings_in_radius(
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer,
  p_min_rent integer default null,
  p_max_rent integer default null,
  p_min_area numeric default null,
  p_layouts text[] default null,
  p_max_building_age integer default null,
  p_max_station_walk integer default null,
  p_limit integer default 500
)
returns setof public.listings
language sql
stable
security invoker
set search_path = public
as $$
  select l.*
  from public.listings l
  where l.is_available
    and st_dwithin(
      l.geom,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    and (p_min_rent is null or l.monthly_rent >= p_min_rent)
    and (p_max_rent is null or l.monthly_rent <= p_max_rent)
    and (p_min_area is null or l.floor_area >= p_min_area)
    and (p_layouts is null or l.layout = any (p_layouts))
    and (p_max_building_age is null or l.building_age <= p_max_building_age)
    and (
      p_max_station_walk is null
      or l.walk_minutes_to_station <= p_max_station_walk
    )
  order by st_distance(
    l.geom,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
  )
  limit least(coalesce(p_limit, 500), 1000);
$$;
