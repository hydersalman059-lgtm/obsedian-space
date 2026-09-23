-- Obsedian.Space: Free plan trial is 45 days.
-- Growth and Scale pricing/limits remain unchanged.

-- Update the Free plan definition.
update public.plans
set
  term_days = 45,
  price_monthly_inr = 0,
  price_yearly_inr = 0,
  max_websites = 1,
  active = true
where id = 'free';

-- New users receive a 45-day Free trial.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, avatar_url)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict(id) do nothing;

  insert into public.subscriptions(
    user_id,
    plan_id,
    billing_cycle,
    status,
    subscription_ends_at
  )
  values(
    new.id,
    'free',
    'free',
    'trial',
    now() + interval '45 days'
  )
  on conflict do nothing;

  return new;
end;
$$;

-- Existing Free trials are converted from the old 365-day term to
-- 45 days from their original subscription start date.
update public.subscriptions
set
  subscription_ends_at = started_at + interval '45 days',
  updated_at = now()
where plan_id = 'free'
  and billing_cycle = 'free'
  and status = 'trial';

-- Make entitlement enforcement server-side for expired/paused accounts.
-- Paid plans retain their existing monthly/yearly terms.
create or replace function public.current_entitlement()
returns table(
  plan_id text,
  max_websites integer,
  status public.subscription_status,
  ends_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    case
      when s.status in ('trial','active')
       and (s.subscription_ends_at is null or s.subscription_ends_at > now())
      then p.max_websites
      else 0
    end as max_websites,
    s.status,
    s.subscription_ends_at
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.user_id = auth.uid()
  order by s.created_at desc
  limit 1;
$$;

-- Keep the expiry job deterministic and make sure expired trials are paused.
create or replace function public.pause_expired_subscriptions()
returns void
language sql
security definer
set search_path = public
as $$
  update public.subscriptions
  set
    status = 'paused',
    paused_at = coalesce(paused_at, now()),
    updated_at = now()
  where status in ('trial','active')
    and subscription_ends_at is not null
    and subscription_ends_at <= now();
$$;
