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

The GitHub Pages deployment publishes a static storefront. The frontend build exports the built-in product catalog from `backend/products.js`, so product search, filters, cart, and the shopping assistant work without a hosted API. The cart is saved in the shopper's browser. The static build skips API requests and displays a preview notice; customer accounts and checkout remain unavailable until the backend and MongoDB are deployed and connected. Local development defaults to API mode and uses the Vite proxy.

## API

- `GET /api/health` — API and database status
- `GET /api/products` and `GET /api/products/:id` — browse the built-in catalog and active database products
- `POST /api/auth/register` and `POST /api/auth/login` — create an optional customer account or sign in
- `GET /api/auth/me` — current account (Bearer token)
- `POST /api/orders` — guest or signed-in checkout; shipping details are required and prices are taken from the server catalog
- `GET /api/orders/mine` — signed-in customer order history
- `GET /api/orders` and `PATCH /api/orders/:id/status` — admin order management
- `POST`, `PATCH`, and `DELETE /api/products` — admin product management (deletion deactivates the product)

New accounts are customers. Grant the `admin` role only to trusted accounts directly in the database; never accept a role from public registration. Manual transfer confirmations create orders with payment still pending and do not verify that funds were received.
