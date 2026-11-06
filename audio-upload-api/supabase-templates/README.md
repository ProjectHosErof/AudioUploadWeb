# Sign-in email templates for Supabase

Supabase sends the sign-in emails, so they're set in its dashboard rather than
sent by the API. These files make them look like every other email the project
sends. **They're generated** from `src/emails/auth.ts` — never edit them by hand.

| File | Supabase tab | Subject |
|---|---|---|
| `magic-link.html` | Magic Link | Your sign-in link for Project Hos Erof |
| `confirm-signup.html` | Confirm signup | Confirm your email for Project Hos Erof |

## Pasting them in
1. Supabase → your project → **Authentication** → **Email Templates**.
2. Open the tab named above, set the **Subject**, and replace the **Message body**
   with the whole contents of the matching file.
3. **Save**, then repeat for the other one.
4. Check it: request a link at hoserof.org/login and look at what arrives.

The link is Supabase's `{{ .ConfirmationURL }}`; Supabase fills it in when it
sends, so leave it exactly as it is.

The other tabs (Invite user, Change email address, Reset password,
Reauthentication) are never sent: the site has no passwords or invitations.

## When the design changes
`npm run emails:supabase` regenerates these files, then paste them in again.
CI runs `npm run check:emails`, which fails if they've fallen out of date.
