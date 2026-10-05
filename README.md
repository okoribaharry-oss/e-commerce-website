# e-commerce-website

## Shopping assistant

The storefront includes a responsive Nova AI shopping assistant. It recommends items from the live product catalog, filters by category and budget, and answers common store questions. Responses run locally in the browser; shopper messages are not sent to an external AI service.

## Local development

Run the API and storefront in separate terminals:

```powershell
cd backend
npm install
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

In development, Vite proxies the storefront's same-origin `/api` requests to `http://localhost:5000` (configured in `frontend/vite.config.js`). Configure backend settings in `backend/.env` using `backend/.env.example`. Start MongoDB at the configured URI before using account, order, or admin features. The product catalog in `backend/products.js` remains available even when MongoDB is offline. In production, serve the frontend and proxy `/api` to the backend on the same site, or configure the deployment's frontend API base URL and backend CORS origins accordingly.

## GitHub Pages

The GitHub Pages deployment publishes the storefront. The frontend build exports the built-in product catalog from `backend/products.js`, so product search, filters, cart, and the shopping assistant work without a hosted API. The root Pages address redirects to the storefront source, with the catalog exporter keeping its JSON copy in sync for branch-based Pages deployments. The cart is saved in the shopper's browser.

To enable live accounts, orders, and Paystack checkout, deploy the Express backend and MongoDB separately. Set `MONGO_URI`, a unique `JWT_SECRET`, `PAYSTACK_SECRET_KEY`, `CLIENT_URL` (the public Pages origin), and `PAYMENT_CALLBACK_URL` (the public storefront URL ending in `/frontend/`) on the backend host. Never put the Paystack secret in frontend variables or commit it. Add the backend's HTTPS origin as the repository Actions variable `VITE_API_BASE_URL`; the Pages workflow embeds this public API URL when it builds the site. The backend verifies successful NGN payments against the server-calculated order total before marking orders paid. Configure the Paystack webhook URL as `https://<backend-host>/api/payments/webhook`; webhook requests are signature-checked.

## API

- `GET /api/health` — API and database status
- `GET /api/products` and `GET /api/products/:id` — browse the built-in catalog and active database products
- `POST /api/auth/register` and `POST /api/auth/login` — create an optional customer account or sign in
- `GET /api/auth/me` — current account (Bearer token)
- `POST /api/orders` — guest or signed-in checkout; shipping details are required and prices are taken from the server catalog
- `GET /api/payments/verify/:reference` — verify a Paystack payment before marking an order paid
- `POST /api/payments/webhook` — handle signature-verified Paystack payment notifications
- `GET /api/orders/mine` — signed-in customer order history
- `GET /api/orders` and `PATCH /api/orders/:id/status` — admin order management
- `POST`, `PATCH`, and `DELETE /api/products` — admin product management (deletion deactivates the product)

Run backend payment verification tests with `npm test` from `backend`.

New accounts are customers. Grant the `admin` role only to trusted accounts directly in the database; never accept a role from public registration. Manual transfer confirmations create orders with payment still pending and do not verify that funds were received.
