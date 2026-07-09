create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  company_name text not null check (char_length(company_name) between 2 and 160),
  email text not null check (char_length(email) <= 254),
  phone text not null check (char_length(phone) <= 32),
  service_required text not null check (char_length(service_required) between 2 and 160),
  budget text not null check (char_length(budget) between 2 and 120),
  timeline text not null check (char_length(timeline) between 2 and 120),
  message text not null check (char_length(message) between 10 and 4000),
  submitted_at timestamptz not null default now(),
  visitor_ip text,
  browser text,
  country text,
  recaptcha_score numeric(3,2),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.leads add column if not exists timeline text;
alter table if exists public.leads add column if not exists is_read boolean not null default false;

create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists leads_submitted_at_idx on public.leads (submitted_at desc);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_is_read_idx on public.leads (is_read);
create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_timeline_idx on public.leads (timeline);
create index if not exists lead_events_lead_id_idx on public.lead_events (lead_id);

alter table public.leads enable row level security;
alter table public.lead_events enable row level security;

drop policy if exists "service role manages leads" on public.leads;
create policy "service role manages leads" on public.leads
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "service role manages lead events" on public.lead_events;
create policy "service role manages lead events" on public.lead_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();
