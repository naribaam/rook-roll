/*
  # Add missing RLS policies for purchases and transactions

  1. Purpose
    The `purchases` table was missing an INSERT policy, meaning authenticated
    users could not insert purchases (the `purchase_item` RPC handles this
    internally with service role, but direct inserts also need to work for
    the store page). Also adding INSERT for transactions for completeness.

  2. Changes
    - Add INSERT policy on `purchases` for authenticated users to insert own purchases
    - Add INSERT policy on `transactions` for authenticated users (for award_coins RPC)

  3. Security
    - Both policies require auth.uid() = user_id to ensure users can only
      write their own data
*/

CREATE POLICY "Users can insert own purchases"
  ON purchases
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
