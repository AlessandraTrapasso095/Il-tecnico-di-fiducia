This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Environment

Copy `.env.example` to `.env.local` and fill the values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

### Database (Supabase)

Migrations live in `supabase/migrations/` and reference data lives in `supabase/seed/`.

### Admin area

The admin area has a dedicated login at `/admin/login`; do not use the customer or
professional login page for admin access.

Admin users are normal Supabase Auth users whose `public.profiles.role` is `admin`.
Create or promote the first admin from Supabase/server-side tooling only, never from
frontend code. Recommended bootstrap values:

- `INITIAL_ADMIN_EMAIL=admin@iltecnicodifiducia.it`
- `INITIAL_ADMIN_TEMP_PASSWORD` set locally/securely, then force password change

After creating the first admin in Supabase Auth, ensure the related row in
`public.profiles` has:

- `role = 'admin'`
- `must_change_password = true`
- `is_banned = false`

The app blocks full admin access while `must_change_password` is true and redirects
the admin to the password-change flow. Admin pages and admin APIs verify the role
server-side.

### Supabase Auth emails

Supabase sends authentication emails from the default "Supabase Auth" sender until
custom SMTP is enabled in the Supabase dashboard. This cannot be changed from the
Next.js codebase alone.

Required production sender:

- Sender name: `Il Tecnico di Fiducia`
- Sender email: `info@iltecnicodifiducia.it`

Manual Supabase configuration:

1. Open Supabase Dashboard.
2. Select the project.
3. Go to `Authentication` → `Settings` → `SMTP Settings` / `Custom SMTP`.
4. Enable custom SMTP.
5. Configure:
   - `Sender email` / `Admin email`: `info@iltecnicodifiducia.it`
   - `Sender name`: `Il Tecnico di Fiducia`
   - `SMTP host`: value from the email provider
   - `SMTP port`: usually `587` with STARTTLS, or provider-specific value
   - `SMTP user`: value from the email provider
   - `SMTP password`: value from the email provider
6. Save and send a test email from Supabase.
7. Go to `Authentication` → `Email Templates` and update these templates:
   - `Confirm signup`
   - `Reset password`
   - `Magic Link / OTP` if enabled
   - `Invite user` if admins invite users

Recommended SMTP providers:

- Resend, Postmark, AWS SES, SendGrid, Brevo, or any provider supporting SMTP.
- Prefer a transactional email provider, not a personal mailbox.

DNS records to configure on `iltecnicodifiducia.it`:

- SPF: TXT record required by the SMTP provider.
- DKIM: TXT/CNAME records required by the SMTP provider.
- DMARC: TXT record on `_dmarc.iltecnicodifiducia.it`, for example:
  `v=DMARC1; p=none; rua=mailto:info@iltecnicodifiducia.it`
- Optional bounce/return-path records if requested by the provider.

After DNS verification, repeat tests for:

- Signup OTP email.
- Resend OTP email.
- Password reset email.
- Admin-created user confirmation/reset emails.

References:

- Supabase custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase email templates: https://supabase.com/docs/guides/auth/auth-email-templates

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
