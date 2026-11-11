begin;

create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 2 and 120),
  email text not null check (char_length(email) <= 254),
  message text not null check (char_length(message) between 10 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from public, anon, authenticated;
grant select, insert on public.contact_messages to service_role;
grant usage, select on sequence public.contact_messages_id_seq to service_role;

commit;
