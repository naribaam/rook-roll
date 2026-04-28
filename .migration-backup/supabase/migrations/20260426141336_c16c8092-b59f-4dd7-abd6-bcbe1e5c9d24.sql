-- Recreate leaderboard view with security_invoker = true
drop view if exists public.leaderboard;

create view public.leaderboard
with (security_invoker = true)
as
select
  id,
  name,
  avatar_url,
  elo,
  coins,
  games_played,
  games_won,
  games_lost,
  games_drawn,
  case when games_played > 0
    then round((games_won::numeric / games_played::numeric) * 100, 1)
    else 0 end as win_rate
from public.profiles
order by elo desc;

grant select on public.leaderboard to anon, authenticated;