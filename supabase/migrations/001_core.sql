create extension if not exists pgcrypto;

create type public.app_role as enum ('user','admin');
create type public.subscription_status as enum ('trial','active','paused','cancelled','expired');
create type public.billing_cycle as enum ('free','monthly','yearly');
create type public.job_status as enum ('queued','running','completed','failed','cancelled');
create type public.approval_status as enum ('pending','approved','rejected','executed','expired');

create table public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text,
 phone text,
 avatar_url text,
 role public.app_role not null default 'user',
 timezone text default 'Asia/Kolkata',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.plans(
 id text primary key,
 name text not null,
 price_monthly_inr integer not null default 0,
 price_yearly_inr integer not null default 0,
 max_websites integer not null,
 term_days integer,
 active boolean not null default true,
 features jsonb not null default '{}'::jsonb
);
insert into public.plans values
('free','Free',0,0,1,365,true,'{"audit":true,"reports":true,"content":true,"ads_strategy":true}'::jsonb)
on conflict(id) do nothing;
insert into public.plans values
('growth','Growth',99,1050,20,null,true,'{"audit":true,"reports":true,"content":true,"ads_strategy":true,"multi_site":true}'::jsonb)
on conflict(id) do nothing;
insert into public.plans values
('scale','Scale',200,1990,100,null,true,'{"audit":true,"reports":true,"content":true,"ads_strategy":true,"multi_site":true,"advanced_analytics":true}'::jsonb)
on conflict(id) do nothing;

create table public.subscriptions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 plan_id text not null references public.plans(id),
 billing_cycle public.billing_cycle not null default 'free',
 status public.subscription_status not null default 'trial',
 provider text,
 provider_customer_id text,
 provider_subscription_id text,
 started_at timestamptz not null default now(),
 subscription_ends_at timestamptz,
 paused_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions(user_id,created_at desc);

create table public.websites(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 url text not null,
 normalized_url text not null,
 name text,
 status text not null default 'pending',
 verified_at timestamptz,
 crawl_frequency text not null default 'weekly',
 last_crawled_at timestamptz,
 next_crawl_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,normalized_url)
);
create index websites_user_idx on public.websites(user_id);

create table public.crawl_pages(
 id uuid primary key default gen_random_uuid(),
 website_id uuid not null references public.websites(id) on delete cascade,
 url text not null,
 status_code integer,
 title text,
 meta_description text,
 canonical_url text,
 word_count integer,
 h1_count integer,
 image_count integer,
 internal_link_count integer,
 load_ms integer,
 noindex boolean,
 raw_signals jsonb not null default '{}'::jsonb,
 crawled_at timestamptz not null default now()
);

create table public.audits(
 id uuid primary key default gen_random_uuid(),
 website_id uuid not null references public.websites(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 score integer,
 technical jsonb not null default '{}'::jsonb,
 seo jsonb not null default '{}'::jsonb,
 content jsonb not null default '{}'::jsonb,
 performance jsonb not null default '{}'::jsonb,
 research jsonb not null default '{}'::jsonb,
 evidence jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now()
);

create table public.recommendations(
 id uuid primary key default gen_random_uuid(),
 website_id uuid not null references public.websites(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 category text not null,
 title text not null,
 description text,
 priority text not null default 'medium',
 impact text,
 effort text,
 evidence jsonb not null default '[]'::jsonb,
 status text not null default 'open',
 created_at timestamptz not null default now()
);

create table public.jobs(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 website_id uuid references public.websites(id) on delete cascade,
 type text not null,
 status public.job_status not null default 'queued',
 priority integer not null default 5,
 payload jsonb not null default '{}'::jsonb,
 result jsonb not null default '{}'::jsonb,
 error text,
 attempts integer not null default 0,
 run_after timestamptz not null default now(),
 started_at timestamptz,
 finished_at timestamptz,
 created_at timestamptz not null default now()
);
create index jobs_queue_idx on public.jobs(status,priority,run_after);

create table public.ai_runs(
 id uuid primary key default gen_random_uuid(),
 job_id uuid references public.jobs(id) on delete set null,
 user_id uuid not null references auth.users(id) on delete cascade,
 website_id uuid references public.websites(id) on delete set null,
 agent text not null,
 provider text not null,
 model text,
 status text not null default 'completed',
 input_tokens integer,
 output_tokens integer,
 estimated_cost numeric(12,6),
 latency_ms integer,
 result jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create table public.approvals(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 website_id uuid references public.websites(id) on delete cascade,
 action_type text not null,
 title text not null,
 description text,
 proposed_change jsonb not null default '{}'::jsonb,
 risk_level text not null default 'medium',
 status public.approval_status not null default 'pending',
 approved_at timestamptz,
 executed_at timestamptz,
 created_at timestamptz not null default now()
);

create table public.integrations(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null,
 account_name text,
 external_account_id text,
 scopes jsonb not null default '[]'::jsonb,
 token_ref text,
 status text not null default 'connected',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(user_id,provider,external_account_id)
);

create table public.ad_campaigns(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 website_id uuid not null references public.websites(id) on delete cascade,
 platform text not null,
 name text not null,
 objective text,
 budget_inr integer,
 status text not null default 'draft',
 approval_id uuid references public.approvals(id),
 external_campaign_id text,
 strategy jsonb not null default '{}'::jsonb,
 metrics jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.usage_events(
 id bigserial primary key,
 user_id uuid references auth.users(id) on delete cascade,
 event_type text not null,
 provider text,
 units numeric default 1,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create table public.support_tickets(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 subject text not null,
 message text not null,
 status text not null default 'open',
 priority text not null default 'normal',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table public.audit_logs(
 id bigserial primary key,
 actor_user_id uuid references auth.users(id) on delete set null,
 action text not null,
 entity_type text,
 entity_id text,
 metadata jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create table public.settings(
 key text primary key,
 value jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
insert into public.settings(key,value) values
('branding','{"brand_name":"Obsedian.Space","logo_url":"","primary_color":"#7c3aed","accent_color":"#f59e0b","support_email":""}')
on conflict(key) do nothing;
