create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,full_name,avatar_url)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.email),new.raw_user_meta_data->>'avatar_url')
 on conflict(id) do nothing;
 insert into public.subscriptions(user_id,plan_id,billing_cycle,status,subscription_ends_at)
 values(new.id,'free','free','trial',now()+interval '365 days')
 on conflict do nothing;
 return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;

create or replace function public.current_entitlement()
returns table(plan_id text,max_websites integer,status public.subscription_status,ends_at timestamptz)
language sql stable security definer set search_path=public
as $$
 select p.id,p.max_websites,s.status,s.subscription_ends_at
 from public.subscriptions s join public.plans p on p.id=s.plan_id
 where s.user_id=auth.uid()
 order by s.created_at desc limit 1
$$;

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.websites enable row level security;
alter table public.crawl_pages enable row level security;
alter table public.audits enable row level security;
alter table public.recommendations enable row level security;
alter table public.jobs enable row level security;
alter table public.ai_runs enable row level security;
alter table public.approvals enable row level security;
alter table public.integrations enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.usage_events enable row level security;
alter table public.support_tickets enable row level security;
alter table public.audit_logs enable row level security;
alter table public.settings enable row level security;

create policy profile_self on public.profiles for all using(auth.uid()=id) with check(auth.uid()=id);
create policy plans_public on public.plans for select using(active=true);
create policy subs_self on public.subscriptions for select using(auth.uid()=user_id);
create policy websites_self on public.websites for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy pages_self on public.crawl_pages for select using(exists(select 1 from public.websites w where w.id=website_id and w.user_id=auth.uid()));
create policy audits_self on public.audits for select using(auth.uid()=user_id);
create policy rec_self on public.recommendations for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy jobs_self on public.jobs for select using(auth.uid()=user_id);
create policy ai_self on public.ai_runs for select using(auth.uid()=user_id);
create policy approvals_self on public.approvals for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy integrations_self on public.integrations for select using(auth.uid()=user_id);
create policy campaigns_self on public.ad_campaigns for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy usage_self on public.usage_events for select using(auth.uid()=user_id);
create policy tickets_self on public.support_tickets for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy logs_self on public.audit_logs for select using(auth.uid()=actor_user_id);
create policy settings_branding_read on public.settings for select using(key='branding');

create or replace function public.enforce_site_limit()
returns trigger language plpgsql security definer set search_path=public as $$
declare lim integer; used integer;
begin
 select max_websites into lim from public.current_entitlement();
 select count(*) into used from public.websites where user_id=new.user_id;
 if lim is null or used >= lim then
   raise exception 'website_limit_reached';
 end if;
 return new;
end $$;
create trigger site_limit before insert on public.websites for each row execute procedure public.enforce_site_limit();

create or replace function public.pause_expired_subscriptions()
returns void language sql security definer set search_path=public as $$
 update public.subscriptions
 set status='paused',paused_at=coalesce(paused_at,now()),updated_at=now()
 where status in ('trial','active') and subscription_ends_at is not null and subscription_ends_at<=now();
$$;
