# Production checklist

## Supabase
- [ ] Create project
- [ ] Run migrations 001-004
- [ ] Enable Email Auth
- [ ] Enable Google OAuth
- [ ] Enable GitHub OAuth
- [ ] Enable phone OTP and an SMS provider
- [ ] Configure storage bucket `brand-assets`
- [ ] Configure SMTP/custom email provider
- [ ] Configure Edge Function secrets
- [ ] Configure scheduled invocation / pg_cron
- [ ] Review RLS policies

## Secrets
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
ANTHROPIC_API_KEY
GEMINI_API_KEY
PERPLEXITY_API_KEY
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
META_APP_ID
META_APP_SECRET

## Cloudflare
- [ ] Create public Pages project
- [ ] Create app Pages project (recommended)
- [ ] Create admin Pages project (recommended)
- [ ] Set environment variables/secrets
- [ ] Configure custom domains
- [ ] Add security headers
- [ ] Add WAF/rate limits as appropriate
- [ ] Configure analytics/logging

## Payments
Create Razorpay plans:
- Growth monthly: ₹99
- Growth yearly: ₹1,050
- Scale monthly: ₹200
- Scale yearly: ₹1,990

Store the resulting plan IDs in environment/config. Webhook events must be signature verified.

## AI
- Set provider keys
- Configure allowed models
- Add per-user daily/monthly usage limits
- Record provider/model/token/cost metadata
- Add retry/backoff and provider failover

## Ads
- Connect Google Ads/Meta
- Never expose access tokens to browser
- Require user approval for campaign creation, budget change, launch, pause and major optimization
- Store external IDs and action logs

## Legal
Replace starter Terms/Privacy with reviewed documents and add consent/cookie controls as required.
