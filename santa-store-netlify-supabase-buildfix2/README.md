# Sumz Store — storefront + admin

Sumz Store is the new premium black/purple storefront being built in this repository. It is separate from the Sumz License Panel database and must only call the licensing service through a scoped server-to-server integration.

## Domains
- Customer: `https://sumz.store`
- Admin: `https://admin.sumz.store` (host-based rewrite routes the root to `/admin`)

Configure both custom domains on the same Netlify site and point their DNS records at Netlify. In Supabase Auth URL Configuration, set the Site URL to `https://sumz.store` and allow `https://sumz.store/**` plus `https://admin.sumz.store/**`.

## Local setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and configure Supabase.
3. Run the existing Supabase migrations in timestamp order, including `20261109190000_sumz_store_platform.sql`.
4. `npm run dev`

## Implemented in this build
- Premium Sumz Store storefront design, responsive catalog sections, live active-product query, customer account entry point, and store footer.
- Admin hostname routing to the existing staff-gated admin area.
- Store schema foundation for product variants, images/metadata, coupons, carts, payment records, fulfillment records, and audit events.
- Existing Sumz Market auth, account, order, support, inventory, and admin flows retained.

## Not yet production-enabled (do not represent as complete)
- **License Panel integration:** the actual Sumz License Panel source/repository and audited API contract are not present in this storefront repository. No licensing endpoint is guessed or overwritten. Provide the panel repository and audit artifact to implement against its real issuance/refresh protocol.
- **Checkout/payment webhooks:** no live payment processing is enabled. Stripe must remain test-only until the processor gives written approval for each product category and the merchant account is configured. A crypto adapter still needs an approved provider.
- **Fulfillment worker, email delivery, product media upload, MFA, and production reconciliation** require additional implementation/configuration and tests before launch.
- The new schema migration has been committed but has **not been applied** to your Supabase project by this code change.
- No production deployment or production license data was changed.

## Security rules
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, payment secrets, or license-service credentials in `NEXT_PUBLIC_*` variables or client bundles.
- Admin writes must be server-side, role checked, and audit logged. Do not add permissive browser write policies.
- Fulfill licenses only after server-verified payment events; use stable order-item idempotency keys and reconciliation.
- Do not bypass payment-provider restrictions or misrepresent product descriptions.

## Deployment checklist
- [ ] Apply migration(s) in Supabase and verify RLS.
- [ ] Configure both domains + HTTPS in Netlify.
- [ ] Configure Supabase SMTP and auth redirect URLs.
- [ ] Set server-only provider credentials in Netlify environment variables.
- [ ] Supply Sumz License Panel repository/API docs; validate in a non-production environment.
- [ ] Complete tests, security review, and a staged checkout/fulfillment simulation.
- [ ] Explicit approval before enabling live payments, changing production license data, or deploying production.
