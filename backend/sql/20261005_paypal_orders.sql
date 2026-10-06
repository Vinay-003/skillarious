-- Inspect production schema and take a backup before applying manually. Non-destructive.
CREATE TABLE IF NOT EXISTS paypal_orders (
  id uuid PRIMARY KEY,
  order_id text UNIQUE,
  user_id uuid NOT NULL REFERENCES users(id),
  course_id uuid NOT NULL REFERENCES courses(id),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL CHECK (currency = 'USD'),
  merchant_id text NOT NULL,
  status text NOT NULL DEFAULT 'creating',
  capture_id text UNIQUE,
  transaction_id uuid REFERENCES transactions(id),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_paypal_capture_unique
  ON transactions(payment_id) WHERE payment_id LIKE 'PAYPAL:%';
CREATE UNIQUE INDEX IF NOT EXISTS transactions_one_active_enrollment
  ON transactions(user_id, course_id) WHERE status = 'completed';
