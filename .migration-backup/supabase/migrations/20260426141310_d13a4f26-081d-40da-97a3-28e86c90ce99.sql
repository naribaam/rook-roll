-- =====================================================
-- CHESS PLATFORM SCHEMA
-- =====================================================

-- Enums
create type public.game_mode as enum ('ai', 'multiplayer');
create type public.game_result as enum ('white_win', 'black_win', 'draw', 'aborted');
create type public.game_status as enum ('waiting', 'active', 'finished');
create type public.tx_type as enum ('starting_bonus', 'win', 'loss', 'draw', 'move_bonus', 'purchase');
create type public.item_type as enum ('piece_skin', 'board_skin');

-- =====================================================
-- PROFILES
-- =====================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null default 'Player',
  avatar_url text,
  coins integer not null default 200 check (coins >= 0),
  elo integer not null default 1200,
  active_piece_skin text not null default 'classic',
  active_board_skin text not null default 'classic',
  games_played integer not null default 0,
  games_won integer not null default 0,
  games_lost integer not null default 0,
  games_drawn integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile (limited)"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- =====================================================
-- GAMES
-- =====================================================
create table public.games (
  id uuid primary key default gen_random_uuid(),
  mode public.game_mode not null,
  status public.game_status not null default 'waiting',
  white_player uuid references public.profiles(id) on delete set null,
  black_player uuid references public.profiles(id) on delete set null,
  ai_difficulty integer, -- 1..20 stockfish skill
  ai_color text check (ai_color in ('white','black')),
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text not null default '',
  moves jsonb not null default '[]'::jsonb,
  result public.game_result,
  result_reason text,
  white_elo_before integer,
  black_elo_before integer,
  white_elo_after integer,
  black_elo_after integer,
  room_code text unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index games_white_idx on public.games(white_player);
create index games_black_idx on public.games(black_player);
create index games_status_idx on public.games(status);
create index games_room_idx on public.games(room_code);

alter table public.games enable row level security;

-- Multiplayer games: viewable by participants, AI games: viewable by player
create policy "Players can view own games"
  on public.games for select
  using (
    auth.uid() = white_player
    or auth.uid() = black_player
    or (status = 'waiting' and mode = 'multiplayer')
  );

create policy "Authenticated users can create games"
  on public.games for insert
  with check (auth.uid() = created_by);

create policy "Players can update own games"
  on public.games for update
  using (auth.uid() = white_player or auth.uid() = black_player);

-- =====================================================
-- TRANSACTIONS
-- =====================================================
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.tx_type not null,
  amount integer not null,
  description text,
  game_id uuid references public.games(id) on delete set null,
  created_at timestamptz not null default now()
);

create index tx_user_idx on public.transactions(user_id, created_at desc);

alter table public.transactions enable row level security;

create policy "Users can view own transactions"
  on public.transactions for select using (auth.uid() = user_id);

-- Inserts only via security definer functions

-- =====================================================
-- PURCHASES (inventory)
-- =====================================================
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_type public.item_type not null,
  item_id text not null,
  price integer not null,
  created_at timestamptz not null default now(),
  unique(user_id, item_type, item_id)
);

create index purchases_user_idx on public.purchases(user_id);

alter table public.purchases enable row level security;

create policy "Users can view own purchases"
  on public.purchases for select using (auth.uid() = user_id);

-- =====================================================
-- TIMESTAMP TRIGGER
-- =====================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create trigger games_updated_at before update on public.games
  for each row execute function public.tg_set_updated_at();

-- =====================================================
-- AUTO PROFILE ON SIGNUP
-- =====================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email,'Player'), '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  );

  insert into public.transactions (user_id, type, amount, description)
  values (new.id, 'starting_bonus', 200, 'Welcome bonus');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================
-- SECURITY DEFINER: award coins (used by edge function)
-- Authoritative, prevents client tampering
-- =====================================================
create or replace function public.award_coins(
  _user_id uuid,
  _amount integer,
  _type public.tx_type,
  _description text,
  _game_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if _amount < 0 then
    raise exception 'award_coins amount must be non-negative';
  end if;

  update public.profiles
    set coins = coins + _amount
    where id = _user_id
    returning coins into new_balance;

  insert into public.transactions(user_id, type, amount, description, game_id)
  values (_user_id, _type, _amount, _description, _game_id);

  return new_balance;
end;
$$;

-- =====================================================
-- SECURITY DEFINER: purchase item
-- =====================================================
create or replace function public.purchase_item(
  _item_type public.item_type,
  _item_id text,
  _price integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_coins integer;
  already_owned boolean;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if _price < 0 then
    raise exception 'Invalid price';
  end if;

  select exists(
    select 1 from public.purchases
    where user_id = uid and item_type = _item_type and item_id = _item_id
  ) into already_owned;

  if already_owned then
    raise exception 'Item already owned';
  end if;

  select coins into current_coins from public.profiles where id = uid for update;

  if current_coins < _price then
    raise exception 'Insufficient coins';
  end if;

  update public.profiles set coins = coins - _price where id = uid;

  insert into public.purchases(user_id, item_type, item_id, price)
  values (uid, _item_type, _item_id, _price);

  insert into public.transactions(user_id, type, amount, description)
  values (uid, 'purchase', -_price, _item_type::text || ':' || _item_id);

  return jsonb_build_object('success', true, 'new_balance', current_coins - _price);
end;
$$;

-- =====================================================
-- SECURITY DEFINER: equip skin (only if owned or 'classic')
-- =====================================================
create or replace function public.equip_skin(
  _item_type public.item_type,
  _item_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  owns boolean;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if _item_id <> 'classic' then
    select exists(
      select 1 from public.purchases
      where user_id = uid and item_type = _item_type and item_id = _item_id
    ) into owns;
    if not owns then
      raise exception 'Item not owned';
    end if;
  end if;

  if _item_type = 'piece_skin' then
    update public.profiles set active_piece_skin = _item_id where id = uid;
  else
    update public.profiles set active_board_skin = _item_id where id = uid;
  end if;
end;
$$;

-- =====================================================
-- LEADERBOARD VIEW (public read)
-- =====================================================
create or replace view public.leaderboard as
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