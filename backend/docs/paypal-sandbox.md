# PayPal Sandbox setup

1. In PayPal Developer Dashboard → Sandbox → Accounts, create one **United States BUSINESS** seller and several **United States PERSONAL** buyer accounts. Account creation happens in PayPal, not through this application. Keep passwords and account exports private.
2. Under Apps & Credentials (Sandbox), create a REST app linked to the BUSINESS seller. Set server-only `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_MERCHANT_ID` in ignored `backend/.env.local`. Optional `PAYPAL_MODE=sandbox` is the default. Live mode additionally requires `PAYPAL_MODE=live` and `PAYPAL_ENABLE_LIVE=true`; do not enable live before a separate release review.
3. Apply `backend/sql/20261005_paypal_orders.sql` only after inspecting the target schema and backing it up. It creates intent storage and replay-prevention indexes; it does not reset existing data. Resolve any pre-existing duplicate completed enrollments before applying the unique index.
4. Prepare a local **private** bulk-account planning CSV using this header (replace with the exact header supplied by your PayPal dashboard if its template differs): `account_type,country,currency,email,first_name,last_name`. Include `BUSINESS,US,USD` for one row and `PERSONAL,US,USD` for buyer rows. A local generator example (never commit its output):

   ```python
   import csv
   with open('paypal-sandbox-private.csv', 'w', newline='') as file:
       writer = csv.writer(file)
       writer.writerow(['account_type', 'country', 'currency', 'email', 'first_name', 'last_name'])
       writer.writerow(['BUSINESS', 'US', 'USD', 'seller@example.invalid', 'Sandbox', 'Seller'])
       for index in range(1, 11):
           writer.writerow(['PERSONAL', 'US', 'USD', f'buyer{index}@example.invalid', 'Sandbox', f'Buyer{index}'])
   ```

   This CSV is a planning template, **not** an automatic PayPal account import. Create accounts in the dashboard and use its supplied CSV headers for any supported export/import workflow. Never put real credentials in the CSV or repository.

Checkout: authenticated `POST /api/v1/payments/create` `{ "courseId": "uuid" }` returns `{ success, orderId, approvalUrl, currency: "USD" }`; redirect to `approvalUrl`. After approval, authenticated `POST /api/v1/payments/verify` `{ "orderId": "..." }` captures/validates the stored order. `GET /api/v1/payments/config` exposes only client ID/mode/currency. Admin `POST /api/v1/payments/refund` accepts only `{ "orderId": "..." }`.
