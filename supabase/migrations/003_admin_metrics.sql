create or replace function public.admin_metrics()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'admin_only'; end if;
 return jsonb_build_object(
  'users',(select count(*) from public.profiles),
  'websites',(select count(*) from public.websites),
  'active_subscriptions',(select count(*) from public.subscriptions where status='active'),
  'paused_subscriptions',(select count(*) from public.subscriptions where status='paused'),
  'audits',(select count(*) from public.audits),
  'ai_runs',(select count(*) from public.ai_runs),
  'pending_approvals',(select count(*) from public.approvals where status='pending'),
  'ad_campaigns',(select count(*) from public.ad_campaigns)
 );
end $$;
