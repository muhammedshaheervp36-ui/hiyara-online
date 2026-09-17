# Hiyara website — corrected source

## Run locally

Install Node.js 20 or newer. Extract this ZIP, open a terminal in the `HIYARA WEB` folder, then run:

```sh
npm run setup-admin
npm start
```

The setup command creates an admin or changes the password for an existing admin email. It reads the password in the terminal without logging it. Choose a new password: the original project used publicly known default credentials. Existing user records are preserved; their passwords are not silently changed. Existing sessions were cleared because the original server exposed its session file.

Open http://localhost:3001 for the storefront and http://localhost:3001/admin for administration. Run through the Node server, not by double-clicking the HTML files. No npm dependencies need installation for the server or tests.

`PORT` can change the port. `HIYARA_DATA_DIR` can point to a separate persistent data directory. For HTTPS production hosting, set `NODE_ENV=production` so session cookies use Secure. The JSON data directory must be writable and must not be exposed by a separate static web server.

## Corrections

- Blocked public downloads of customer records, user/password hashes, sessions, server source, and debug pages.
- Removed hard-coded admin bearer tokens and client-controlled role headers. Authorization now resolves the current account for every request.
- Fixed `/admin`, malformed URL/cookie handling, invalid JSON responses, payload-size responses, static MIME types, and failed file reads.
- Removed permissive cross-origin admin API headers. The frontend uses same-origin session authentication.
- Stopped automatically creating accounts with known passwords. Added explicit admin setup/reset.
- Added atomic customer/user/audit/session writes. Store read errors no longer silently replace existing data with demo defaults.
- Hardened customer status, phone, order-count, and spending validation. Editing without an order-count field preserves the existing count.
- Fixed false success reports when customer save/delete requests fail.
- Removed automatic sample cart/order insertion. Empty carts and order lists remain empty after reload.
- Fixed decimal prices in cart totals, admin order details, and invoices. Checkout uses the same tax/discount summary as the cart.
- Enforced stock limits across cart variants and quantities; blocked out-of-stock purchases and checked stock before saving a preview order.
- Added stock editing and price validation in the product editor.
- Fixed collection delete buttons, necklace category matching, missing-product handling, and variant selection.
- Added damaged/partial browser-storage recovery and migration of old cart items without quantities.
- Escaped customer/product text at display boundaries and checked common image URL attributes.
- Removed the debug checkout alert and false paid status. Preview orders use unique IDs, remain unpaid, clear promo codes, and reduce local stock.
- Customer sign-in/sign-up no longer pretends to authenticate any password. Disconnected contact/newsletter forms no longer claim successful delivery.
- Added graceful feedback when popup printing or the external PDF export script is unavailable.

## Important remaining limitations

This source is still a storefront prototype, not a complete production ecommerce system:

1. Products, shop settings, cart, and orders use **localStorage in one browser/origin**. Product changes are not published to other customers' devices. Orders are not transmitted to the seller. This architecture is retained; implementing shared catalog/order APIs is a separate development task.
2. Only administrator sessions and customer-record CRUD are backed by the Node server. Customer registration/login, contact delivery, and newsletter subscriptions need backend integrations.
3. No payment gateway is connected. Card payment is disabled. Checkout is explicitly labelled a browser-only preview; it does not take money or send orders.
4. Stock enforcement is local only and cannot prevent concurrent purchases across devices. Prices, stock, promotions, and order totals need server-side verification before real checkout is enabled.
5. The uploaded ZIP did not include the referenced product/hero photographs. Existing placeholder images remain; upload your original product photos through the admin editor. No replacement photographs were invented.
6. The original 8% estimated tax and DISCOUNT10 demo promotion remain for preview calculations. Configure actual business pricing/tax/shipping rules before launch.
7. Existing saved data and sample records were retained, except sessions were invalidated. Reset original default admin passwords before any public deployment. Production work should also add login rate limiting, shared data storage/backups, and a full security review.
8. External fonts and PDF export need internet access. This revision does not deploy or publish the website.

## Verification

```sh
npm test
```

Passed: seven HTTP/backend regression cases and one storefront/admin simulation suite containing eight scenario groups. Tests use temporary backend data, never your customer database.

The frontend checks cover initialization, empty-cart persistence, decimal prices, quantities and stock limits, discount/checkout consistency, preview order persistence, damaged storage, escaped text, and collection deletion. They run JavaScript with a simulated DOM; they are not a substitute for visual browser tests.

A real Chromium run was unavailable: no browser binary was installed and the download timed out. Desktop/mobile appearance, actual click/focus interactions, PDF layout, and external resources still need checking in Chrome or another browser. Inline script syntax was checked for the storefront, admin dashboard, and admin login page.

`test.html`, `test.js`, and `scripts/app.js` from the original archive are retained for reference. The active storefront code is inline in `index.html`; those legacy debug pages are not served by the Node server. The old admin/customer test commands now invoke the isolated regression suite.

## GitHub and Vercel deployment

This repository excludes private runtime data and credentials. Create a local admin with `npm run setup-admin`; existing local records can remain in your own `data/` directory.

The Vercel configuration builds a **static storefront preview** into `dist/` using `npm run build`. Import this repository in Vercel with the repository root as Root Directory. Build command and output directory are set in `vercel.json`, following https://vercel.com/docs/project-configuration . No API keys are needed for this preview.

The build publishes only the storefront, its assets, and an explanatory admin-unavailable page. Server code, customer data, admin login/dashboard, and test pages are not published as static files. Admin features continue to work locally via `npm start`; online admin and real orders require a persistent backend/database deployment. The preview checkout does not send orders or charge payments.
