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

The Pages workflow publishes the storefront at `/e-commerce-website/frontend/` and redirects the project root there. The frontend build exports the built-in product catalog from `backend/products.js`, so product search, filters, cart, and the shopping assistant work without a hosted API. The cart is saved in the shopper's browser.

For the workflow's API URL variable to take effect, select **GitHub Actions** under **Repository Settings → Pages → Build and deployment → Source**. Branch publishing serves the source HTML with literal Vite placeholders and cannot embed Actions variables. With no `VITE_API_BASE_URL`, the Pages storefront remains a product-browsing preview and checkout/accounts stay unavailable.

## Paystack deployment (Railway + MongoDB Atlas)

1. Create a Railway service from this repository and set its root directory to `/backend`; Railway can start it with `npm start` and provide its `PORT`.
2. Create a MongoDB Atlas database and allow the Railway service to connect. Add these variables to the Railway service:
   - `MONGO_URI` — the Atlas connection string
   - `JWT_SECRET` — a unique random secret of at least 32 characters
   - `CLIENT_URL=https://okoribaharry-oss.github.io`
   - `PAYSTACK_SECRET_KEY` — start with a Paystack test secret; enter it only in Railway's private variable settings
   - `PAYMENT_CALLBACK_URL=https://okoribaharry-oss.github.io/e-commerce-website/frontend/`
   - `NODE_ENV=production`
3. After Railway generates the backend's HTTPS domain, configure the Paystack webhook as `https://<backend-host>/api/payments/webhook`.
4. In GitHub **Settings → Pages**, select **GitHub Actions** as the source. Then open **Settings → Secrets and variables → Actions → Variables** and add `VITE_API_BASE_URL` with the Railway HTTPS origin (for example, `https://<backend-host>`, without a secret). Rerun the Pages workflow to publish the API-connected storefront at the existing URL.
5. Test a transaction with Paystack test credentials before replacing the Railway `PAYSTACK_SECRET_KEY` with a live key.

Never put the Paystack secret in frontend variables or commit it. Checkout totals are calculated from the server catalog, and the backend verifies successful NGN payments before marking orders paid.

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
