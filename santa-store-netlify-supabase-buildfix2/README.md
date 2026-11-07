# Santa Store — Netlify + Supabase

Holiday storefront scaffold for Sumz Market. Includes Next.js pages, Supabase client, customer email/password sign-up/sign-in/password-reset UI, product catalog display, and starter SQL.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env.local`, fill the Supabase Project URL and anon key.
3. Run `supabase/schema.sql` in Supabase SQL Editor.
4. `npm run dev`

## Deploy to Netlify
- Push this folder to a GitHub repository.
- In Netlify, import the repository. Netlify's Next.js runtime handles routing/server rendering.
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables.
- Add `sumz.store` and `admin.sumz.store` DNS/domain configuration.
- In Supabase Auth > URL Configuration, set Site URL to `https://sumz.store` and add redirect URLs for `https://sumz.store/**` and `https://admin.sumz.store/**`.
- Configure Supabase SMTP (production email) and your verified sender domain.

## Current status (starter, not yet production-ready)
- Home page uses a preview catalog if no products are present; seed products are not actual stock.
- Supabase auth UI supports sign up, sign in, reset email; verify redirect and configure SMTP.
- Admin page is only a login shell. Add server-side role authorization + admin product/order management before opening it.
- No checkout/order creation or payment verification yet; no auto-delivery or Fenar integration yet.
- Add payment methods through compliant commercial payment workflows. Cash App/PayPal manual review, Rewarble redemption checks, and crypto network confirmations must be verified server-side before fulfillment.
- Product/account trading may violate game/platform terms and payment-provider policies. Confirm legality and provider approval before accepting orders.
- Do not add any secret keys to client-side or `NEXT_PUBLIC_` environment variables.

## Product entry
Insert products into `public.products`; prices are integer cents. `price_max_cents` displays a range. Keep `active=false` until an item is ready for publication.

## Next implementation milestones
1. Admin role + RLS policies and secure server actions.
2. Product CRUD/image upload (Supabase Storage).
3. Checkout, order/payment proof, admin approve/reject and audit log.
4. Rewarble and crypto payment verification; confirmations and duplicate webhook protection.
5. Email templates via Resend and Supabase SMTP.
6. Inventory reservation and delivery workflow, tests, monitoring, backup plan.
