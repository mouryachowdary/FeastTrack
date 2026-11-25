# FeastTrack

FeastTrack helps teams manage weekly biryani orders, vendor prices, and office refunds.

## Development

Install [Bun](https://bun.sh/) and run:

```sh
bun install
bun run dev
```

## Checks

```sh
bun run test
bun run lint
bun run build
```

## Team accounts

Employees sign in with their actual registered Supabase Auth email and password. Password entry is limited to 14 characters.

Create the first confirmed user directly in Supabase Authentication; the first account automatically joins an empty team. For each additional person, invite their actual email in the app before creating their Supabase Auth account so the team-membership trigger can authorize them. Every team member can create and edit orders for any person in the app.

Administrators can create employee accounts, assign roles, manage employee access, send password reset emails, and review login activity from the employee tools on the home dashboard. Creating an account confirms the email address entered by the administrator, so verify that address before provisioning it. New accounts receive the employee role from the existing Supabase trigger.

## Supabase employee setup

Review and run these standalone scripts manually in the Supabase SQL Editor. They are not migrations and are not executed by the application:

- `supabase/sql/employee_profile_auth_foreign_key.sql` checks for orphan profiles and adds the profile-to-Auth foreign key with `ON DELETE CASCADE`.
- `supabase/sql/employee_activity.sql` creates the session activity table with RLS enabled. Authenticated users receive read access only when `public.is_admin()` returns true; application writes use the trusted server-side service role.

Configure these server environment variables in the deployment platform:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — private server-only secret; never use a `VITE_` prefix.
- `APP_BASE_URL` — the absolute deployed application URL, used as the password reset redirect (for example, `https://your-app.example`).

The browser also needs the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` values. Add `${APP_BASE_URL}/auth` to the Supabase Auth redirect URL allowlist so password recovery can return to FeastTrack.

The service-role key is loaded only inside authenticated server functions. Do not expose it to browser code or commit it to source control.

## Stack

- TanStack Start and TanStack Router
- React and TypeScript
- Supabase authentication and database
- Tailwind CSS
