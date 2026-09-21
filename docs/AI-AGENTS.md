# Agent architecture

## Orchestrator
The orchestrator receives a job:
`audit`, `seo_strategy`, `content_plan`, `competitor_research`, `ads_strategy`, `weekly_report`.

It creates child agent tasks:
- crawler
- technical SEO
- content
- research
- ads strategy
- executive reporter

Each task has:
- tenant/user ID
- website ID
- provider
- model
- status
- retry count
- input/output usage
- evidence references
- result JSON

## Provider policy
Provider selection is task based:
- OpenAI: general structured analysis
- Claude: long-form synthesis
- Gemini: alternate reasoning/content
- Perplexity: research/search-grounded tasks

Use a second provider only when the task benefits from independent analysis. Do not send private customer data to a provider unless it is necessary for that configured feature.

## Guardrails
- Do not fabricate rankings, traffic, conversions or ad performance.
- Clearly mark estimates.
- Store evidence URLs where available.
- Ad execution requires `approved_at`.
- Budget changes require a fresh approval.
