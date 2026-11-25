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

The app accepts assigned usernames only; account creation is disabled in the sign-in screen. Usernames are case-insensitive and map to Supabase Auth emails in the form `<username>@login.feasttrack.invalid`.

Create the first confirmed user directly in Supabase Authentication; the first account automatically joins an empty team. For each additional person, invite their username in the app first, then create a confirmed Supabase Auth user with that exact mapped email and the password you assign. The invite must exist before account creation so the team-membership trigger can authorize the account. Disable public sign-ups in the Supabase project's Auth settings, and enter passwords directly in Supabase rather than storing them in source code. Every team member can create and edit orders for any person in the app.

## Stack

- TanStack Start and TanStack Router
- React and TypeScript
- Supabase authentication and database
- Tailwind CSS
