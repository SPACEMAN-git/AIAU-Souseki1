-- 地図 viewport（bounding box）で賃貸物件を引く RPC。
-- 既存の search_listings_in_radius（半径検索）はそのまま残す。
create or replace function public.search_listings_in_bounds(
  p_north double precision,
  p_south double precision,
  p_east double precision,
  p_west double precision,
  p_min_rent integer default null,
  p_max_rent integer default null,
  p_limit integer default 300
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
    and st_intersects(
      l.geom,
      st_makeenvelope(
        least(p_west, p_east),
        least(p_south, p_north),
        greatest(p_west, p_east),
        greatest(p_south, p_north),
        4326
      )::geography
    )
    and (p_min_rent is null or l.monthly_rent >= p_min_rent)
    and (p_max_rent is null or l.monthly_rent <= p_max_rent)
  order by l.monthly_rent
  limit least(coalesce(p_limit, 300), 1000);
$$;
