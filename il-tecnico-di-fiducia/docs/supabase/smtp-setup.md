# SMTP custom (quando avrete il dominio)

Questa guida serve per passare dalle email “di default Supabase” ad un SMTP vostro (con dominio ufficiale).

## 1) Prerequisiti

- Dominio pronto (es. `iltecnicodifiducia.it`)
- Una mailbox/alias “From” (es. `no-reply@iltecnicodifiducia.it`)
- Un provider SMTP (esempi comuni: Amazon SES, SendGrid, Mailgun, Postmark)

## 2) Configurare DNS (SPF/DKIM/DMARC)

Dal provider SMTP vi verranno forniti i record DNS da aggiungere:

- SPF (TXT)
- DKIM (TXT/CNAME)
- (Consigliato) DMARC (TXT)

Aspettate la validazione dal provider prima di procedere.

## 3) Supabase: impostare SMTP

Supabase Dashboard → **Authentication** → **Providers** → **Email** → sezione **SMTP Settings**:

- Host
- Port
- Username
- Password
- Sender name (es. “Il Tecnico di Fiducia”)
- Sender email (es. `no-reply@iltecnicodifiducia.it`)

## 4) Supabase: URL corretti per redirect (password reset / callback)

Supabase Dashboard → **Authentication** → **URL Configuration**:

- **Site URL**: impostare il dominio canonico (es. `https://iltecnicodifiducia.it`)
- **Additional Redirect URLs**: aggiungere eventuali staging/preview (es. Vercel preview)

Nel repo, potete impostare anche:

- `NEXT_PUBLIC_SITE_URL` in `il-tecnico-di-fiducia/.env.local` (consigliato in produzione)

Questo viene usato per costruire `redirectTo` lato server (es. reset password) in modo robusto anche dietro proxy.

## 5) (Opzionale) Personalizzare template email

Supabase Dashboard → **Authentication** → **Email Templates**:

- Confirm signup (OTP)
- Reset password
- (eventuali altri flussi che abiliterete)

Template di riferimento per OTP:

- `il-tecnico-di-fiducia/docs/supabase/email-templates/confirm-signup-otp.html`

Consiglio: mantenere i template “semplici” e mobile-friendly (max width 600–640px).

