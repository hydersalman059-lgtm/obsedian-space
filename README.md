# Obsedian.Space Production SaaS v2

AI-powered digital marketing automation for businesses.

## Stack
- Cloudflare Pages + Pages Functions
- Supabase Auth + Postgres + RLS + Storage + Edge Functions
- OpenAI + Anthropic Claude + Google Gemini + Perplexity provider adapter
- Razorpay subscription lifecycle
- Optional Google Search Console / Analytics, Google Ads and Meta Ads integrations
- Scheduled audits and reports
- Approval-gated ad execution

## Commercial plans
- Free: ₹0 / 365 days / 1 website URL
- Growth: ₹99 monthly / ₹1,050 yearly / 20 URLs
- Scale: ₹200 monthly / ₹1,990 yearly / 100 URLs

## Production workflow
1. Register/sign in.
2. Free entitlement is created automatically for 365 days.
3. Add and verify websites.
4. Website enters an audit queue.
5. Crawl + SEO extraction creates normalized signals.
6. Agent orchestrator runs specialized AI agents.
7. Recommendations are stored with priority and evidence.
8. Content/ad strategies become approval items.
9. User approves changes.
10. Connected APIs execute only approved actions.
11. Metrics are synchronized.
12. Daily/weekly reports summarize changes.
13. Expired subscriptions become `paused`; automation refuses paused accounts.

## Security model
- Browser gets only Supabase publishable key.
- Service role/secret keys never ship to browser.
- Every customer table is tenant scoped.
- Admin role is enforced in database functions and Edge Functions.
- Admin is intended to run on `admin.obsedian.space` as a separate Cloudflare Pages project.
- Advertising execution is disabled until explicit approval.
- Webhook signatures must be verified before subscription changes.

## Before launch
Configure all values in `docs/PRODUCTION-CHECKLIST.md`, replace legal placeholder pages, verify OAuth redirect URIs, configure Razorpay plan IDs, and perform a security review.
