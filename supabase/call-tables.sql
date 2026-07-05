-- Call tables SQL (Apply via Supabase SQL Editor)

-- Call rooms
create table if not exists call_rooms (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid references channels(id) on delete cascade not null,
  active boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- Call participants
-- Ensure the type exists
do $$ begin
  create type call_participant_status as enum ('active', 'inactive', 'reconnecting');
exception
  when duplicate_object then null;
end $$;

create table if not exists call_participants (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references call_rooms(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  status call_participant_status default 'active',
  joined_at timestamp with time zone default now(),
  last_seen_at timestamp with time zone default now(),
  unique(room_id, user_id)
);

-- Indexes
create index if not exists idx_call_rooms_channel_id on call_rooms(channel_id);
create index if not exists idx_call_participants_room_id on call_participants(room_id);
