# Project guidance

- Do not add or edit files in `supabase/migrations/` or `drizzle/`.
- Do not edit files whose headers identify them as automatically generated.
- Keep secrets out of source control.
- Weekly orders live in Supabase tables `weeks` and `orders`; refund math lives in `src/lib/feast.ts` so pages and tests share one rule set.
- Access to weeks and orders is restricted to rows in `team_members` (first sign-up auto-joins, others join through `team_invites` email); refund data must not be editable by anonymous visitors.
